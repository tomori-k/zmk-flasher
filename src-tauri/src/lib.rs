// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use anyhow::Result;
use once_cell::sync::Lazy;
use rusb::{Context, Device, HotplugBuilder, UsbContext};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

struct MonitoringState {
    registration: rusb::Registration<Context>,
    tx_stop: std::sync::mpsc::Sender<()>,
}

// ホットプラグ監視の登録情報を保持するグローバル変数
static MONITORING_STATE: Lazy<Arc<Mutex<Option<MonitoringState>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

// ZMKキーボード検出のための既知のVID/PIDマッピング
// これは実際のZMKキーボードの値に合わせて調整する必要があります
lazy_static::lazy_static! {
    static ref ZMK_DEVICE_MAP: HashMap<(u16, u16), &'static str> = {
        let mut m = HashMap::new();
        m.insert((0x1d50, 0x615e), "ZMK Project");
        m.insert((0x2886, 0x0045), "Seeed Studio XIAO nRF52840");
        m
    };
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsbDevice {
    id: String,
    name: String,
    side: Option<String>, // 'left' または 'right' に制限したいが、Rustでは列挙型を使用する方が適切
    vid: String,
    pid: String,
    manufacturer: Option<String>,
    product: Option<String>,
    serial: Option<String>,
}

#[derive(thiserror::Error, Debug)]
enum UsbError {
    #[error("USB Error: {0}")]
    Usb(#[from] rusb::Error),
    #[error("Generic Error: {0}")]
    Other(String),
}

/// ZMKキーボードデバイス（ブートローダーモード）を検出
#[tauri::command]
fn detect_zmk_devices() -> Result<Vec<UsbDevice>, String> {
    match get_zmk_devices() {
        Ok(devices) => Ok(devices),
        Err(e) => Err(format!("デバイス検出エラー: {}", e)),
    }
}

/// USBデバイスからZMKキーボードを検出
fn get_zmk_devices() -> Result<Vec<UsbDevice>, anyhow::Error> {
    let context = Context::new()?;
    let mut result = Vec::new();
    let timeout = Duration::from_secs(1);

    for device in context.devices()?.iter() {
        let device_desc = device.device_descriptor()?;
        let vid = device_desc.vendor_id();
        let pid = device_desc.product_id();

        // ZMKデバイスリストに含まれるVID/PIDかチェック
        if let Some(device_type) = ZMK_DEVICE_MAP.get(&(vid, pid)) {
            let mut name = device_type.to_string();
            let mut manufacturer = None;
            let mut product = None;
            let mut serial = None;
            let mut side = None;

            if let Ok(handle) = device.open() {
                let languages = handle.read_languages(timeout)?;
                if !languages.is_empty() {
                    let lang = languages[0];

                    // 製造元情報の取得
                    if let Ok(mfg) = handle.read_manufacturer_string(lang, &device_desc, timeout) {
                        manufacturer = Some(mfg.clone());
                        if name == "Adafruit nRF52840" && mfg.contains("ZMK") {
                            name = "ZMK Keyboard".to_string();
                        }
                    }

                    // 製品名の取得
                    if let Ok(prod) = handle.read_product_string(lang, &device_desc, timeout) {
                        product = Some(prod.clone());
                        // 製品名があれば、それをデバイス名として使用
                        if !prod.is_empty() {
                            name = prod.clone();
                        }

                        // 左右の識別（製品名に "left" や "right" が含まれるか）
                        let prod_lower = prod.to_lowercase();
                        if prod_lower.contains("left") {
                            side = Some("left".to_string());
                        } else if prod_lower.contains("right") {
                            side = Some("right".to_string());
                        }
                    }

                    // シリアル番号の取得
                    if let Ok(ser) = handle.read_serial_number_string(lang, &device_desc, timeout) {
                        serial = Some(ser);
                    }
                }
            }

            // デバイス情報をリストに追加
            let device_id = format!("{:04x}:{:04x}_{}", vid, pid, result.len());
            result.push(UsbDevice {
                id: device_id,
                name,
                side,
                vid: format!("0x{:04X}", vid),
                pid: format!("0x{:04X}", pid),
                manufacturer,
                product,
                serial,
            });
        }
    }

    Ok(result)
}

/// USBデバイスの監視を開始し、変更があった場合にイベントを発行する
#[tauri::command]
fn start_usb_monitoring(app_handle: AppHandle) -> Result<(), String> {
    // ホットプラグがサポートされているか確認
    if !rusb::has_hotplug() {
        return Err("このシステムではUSBホットプラグ機能がサポートされていません".to_string());
    }

    // すでに監視が実行中なら何もしない
    let mut state_guard = MONITORING_STATE.lock().unwrap();
    if state_guard.is_some() {
        return Ok(());
    }

    // USB監視用のコンテキストを作成
    let context = match Context::new() {
        Ok(ctx) => ctx,
        Err(e) => return Err(format!("USBコンテキスト作成エラー: {}", e)),
    };

    // ホットプラグハンドラを作成
    let handler = UsbHotPlugHandler {
        app_handle: app_handle.clone(),
    };

    // 最新のHotplugBuilderを使用してホットプラグコールバックを登録
    let registration = match HotplugBuilder::new()
        .enumerate(true) // すでに接続されているデバイスも対象にする
        .register(&context, Box::new(handler))
    {
        Ok(reg) => reg,
        Err(e) => return Err(format!("ホットプラグコールバック登録エラー: {}", e)),
    };
    let (tx, rx) = std::sync::mpsc::channel();

    // 登録情報をグローバル変数に保存
    *state_guard = Some(MonitoringState {
        registration,
        tx_stop: tx,
    });

    // イベント処理スレッドを開始
    let context_clone = context.clone();
    tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<()> {
        loop {
            context_clone.handle_events(Some(std::time::Duration::from_millis(100)))?;
            match rx.try_recv() {
                Ok(_) | Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    // 停止要求があった場合はループを抜ける
                    break;
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => { /* イベントがない場合は何もしない */
                }
            }
        }
        Ok(())
    });

    Ok(())
}

/// USBデバイスの監視を停止する
#[tauri::command]
fn stop_usb_monitoring() -> Result<(), String> {
    // ホットプラグ監視を解除
    let mut state_guard = MONITORING_STATE.lock().unwrap();
    if let Some(state) = state_guard.take() {
        // 停止要求を送信
        state
            .tx_stop
            .send(())
            .map_err(|e| format!("USB監視停止要求送信エラー: {}", e))?;

        // コンテキスト取得とコールバック解除
        if let Ok(context) = Context::new() {
            let _ = context.unregister_callback(state.registration);
        }
    }

    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            detect_zmk_devices,
            start_usb_monitoring,
            stop_usb_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ホットプラグ機能用のハンドラ構造体
struct UsbHotPlugHandler {
    app_handle: tauri::AppHandle,
}

impl<T: UsbContext> rusb::Hotplug<T> for UsbHotPlugHandler {
    fn device_arrived(&mut self, device: Device<T>) {
        // デバイスの接続を検知
        if let Ok(device_desc) = device.device_descriptor() {
            let vid = device_desc.vendor_id();
            let pid = device_desc.product_id();

            // ZMKデバイスリストに含まれるVID/PIDかチェック
            if ZMK_DEVICE_MAP.get(&(vid, pid)).is_some() {
                // デバイスリストを取得してフロントエンドに通知
                if let Ok(devices) = get_zmk_devices() {
                    // フロントエンドにUSBデバイス変更イベントを送信
                    let _ = self.app_handle.emit("usb-device-changed", devices.clone());
                }
            }
        }
    }

    fn device_left(&mut self, device: Device<T>) {
        // デバイスの切断を検知
        if let Ok(device_desc) = device.device_descriptor() {
            let vid = device_desc.vendor_id();
            let pid = device_desc.product_id();

            // ZMKデバイスリストに含まれるVID/PIDかチェック
            if ZMK_DEVICE_MAP.get(&(vid, pid)).is_some() {
                // デバイスリストを取得してフロントエンドに通知
                if let Ok(devices) = get_zmk_devices() {
                    // フロントエンドにUSBデバイス変更イベントを送信
                    let _ = self.app_handle.emit("usb-device-changed", devices.clone());
                }
            }
        }
    }
}
