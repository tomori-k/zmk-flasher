// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use anyhow::Result;
use rusb::{Context, UsbContext};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, detect_zmk_devices])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
