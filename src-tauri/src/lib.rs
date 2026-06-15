use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serialport::{SerialPortType, UsbPortInfo};
use std::{
    collections::HashSet,
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    process::Command as ProcessCommand,
    time::Duration,
};
use zip::ZipArchive;

const RELEASE_URL: &str =
    "https://api.github.com/repos/tomori-k/zmk-config-broccoli/releases/latest";
const USER_AGENT: &str = "zmk-flasher/0.1.0";

#[derive(Debug, Clone, Serialize)]
struct DeviceInfo {
    id: String,
    label: String,
    model: String,
    kind: DeviceKind,
    status: DeviceStatus,
    status_label: String,
    supported: bool,
    can_flash: bool,
    can_enter_bootloader: bool,
    mount_path: Option<String>,
    port_name: Option<String>,
    vendor_id: Option<u16>,
    product_id: Option<u16>,
    serial_number: Option<String>,
    location_id: Option<u32>,
    detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
enum DeviceKind {
    Bootloader,
    Serial,
    Usb,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
enum DeviceStatus {
    BootloaderReady,
    AppMode,
    BootloaderRequired,
    Unsupported,
}

#[derive(Debug, Default)]
struct MacUsbDevice {
    vendor_id: Option<u16>,
    product_id: Option<u16>,
    vendor_name: Option<String>,
    product_name: Option<String>,
    serial_number: Option<String>,
    location_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
struct FirmwareAsset {
    id: String,
    name: String,
    size: u64,
    download_url: String,
    source_asset_id: u64,
    source_asset_name: String,
    archive_entry: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ReleaseInfo {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
    assets: Vec<FirmwareAsset>,
}

#[derive(Debug, Serialize)]
struct FlashResult {
    release_tag: String,
    asset_name: String,
    device_label: String,
    mount_path: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    id: u64,
    name: String,
    size: u64,
    browser_download_url: String,
}

#[tauri::command]
async fn scan_devices() -> Result<Vec<DeviceInfo>, String> {
    tauri::async_runtime::spawn_blocking(scan_devices_sync)
        .await
        .map_err(|error| format!("Device scan task failed: {error}"))
}

#[tauri::command]
async fn fetch_latest_release() -> Result<ReleaseInfo, String> {
    tauri::async_runtime::spawn_blocking(fetch_latest_release_sync)
        .await
        .map_err(|error| format!("Release fetch task failed: {error}"))?
}

#[tauri::command]
async fn flash_device(device_id: String, asset_id: String) -> Result<FlashResult, String> {
    tauri::async_runtime::spawn_blocking(move || flash_device_sync(&device_id, asset_id))
        .await
        .map_err(|error| format!("Flash task failed: {error}"))?
}

fn scan_devices_sync() -> Vec<DeviceInfo> {
    let mut devices = Vec::new();
    devices.extend(scan_uf2_volumes());
    devices.extend(scan_serial_devices());
    devices.extend(scan_usb_devices());
    let mut devices = dedupe_devices(devices);
    devices.sort_by(|a, b| {
        b.supported
            .cmp(&a.supported)
            .then_with(|| b.can_flash.cmp(&a.can_flash))
            .then_with(|| a.label.cmp(&b.label))
    });
    devices
}

fn dedupe_devices(devices: Vec<DeviceInfo>) -> Vec<DeviceInfo> {
    let bootloader_products: HashSet<(u16, u16)> = devices
        .iter()
        .filter(|device| matches!(device.kind, DeviceKind::Bootloader) && device.can_flash)
        .filter_map(device_product_key)
        .collect();
    let serial_products: HashSet<(u16, u16)> = devices
        .iter()
        .filter(|device| matches!(device.kind, DeviceKind::Serial) && device.supported)
        .filter_map(device_product_key)
        .collect();
    let mut seen_serials = HashSet::new();
    let mut deduped = Vec::new();

    let mut ordered = devices;
    ordered.sort_by_key(dedupe_priority);

    for device in ordered {
        if !matches!(device.kind, DeviceKind::Bootloader)
            && device_product_key(&device).is_some_and(|key| bootloader_products.contains(&key))
        {
            continue;
        }

        if matches!(device.kind, DeviceKind::Usb)
            && device_product_key(&device).is_some_and(|key| serial_products.contains(&key))
        {
            continue;
        }

        if matches!(device.kind, DeviceKind::Serial)
            && serial_dedupe_key(&device).is_some_and(|key| !seen_serials.insert(key))
        {
            continue;
        }

        deduped.push(device);
    }

    deduped
}

fn dedupe_priority(device: &DeviceInfo) -> u8 {
    match device.kind {
        DeviceKind::Bootloader => 0,
        DeviceKind::Serial
            if device
                .port_name
                .as_deref()
                .is_some_and(|port| port.contains("/cu.")) =>
        {
            1
        }
        DeviceKind::Serial => 2,
        DeviceKind::Usb => 3,
    }
}

fn device_product_key(device: &DeviceInfo) -> Option<(u16, u16)> {
    Some((device.vendor_id?, device.product_id?))
}

fn serial_dedupe_key(device: &DeviceInfo) -> Option<String> {
    Some(format!(
        "{:04x}:{:04x}:{}",
        device.vendor_id?,
        device.product_id?,
        device
            .serial_number
            .as_deref()
            .unwrap_or(device.label.as_str())
    ))
}

fn scan_uf2_volumes() -> Vec<DeviceInfo> {
    volume_roots()
        .into_iter()
        .filter_map(|root| fs::read_dir(root).ok())
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter_map(|entry| uf2_volume_device(entry.path()))
        .collect()
}

fn volume_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    #[cfg(target_os = "macos")]
    roots.push(PathBuf::from("/Volumes"));
    #[cfg(target_os = "linux")]
    {
        if let Ok(user) = std::env::var("USER") {
            roots.push(PathBuf::from(format!("/media/{user}")));
            roots.push(PathBuf::from(format!("/run/media/{user}")));
        }
    }
    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            roots.push(PathBuf::from(format!("{}:\\", letter as char)));
        }
    }
    roots
}

fn uf2_volume_device(path: PathBuf) -> Option<DeviceInfo> {
    let info_path = path.join("INFO_UF2.TXT");
    if !info_path.exists() {
        return None;
    }

    let volume_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("UF2 Bootloader")
        .to_string();
    let info = fs::read_to_string(&info_path).unwrap_or_default();
    let supported = looks_like_xiao_ble(&format!("{volume_name}\n{info}"));
    let (vendor_id, product_id) = if supported {
        (Some(0x2886), Some(0x0045))
    } else {
        (None, None)
    };
    let status = if supported {
        DeviceStatus::BootloaderReady
    } else {
        DeviceStatus::Unsupported
    };

    Some(DeviceInfo {
        id: format!("volume:{}", path.display()),
        label: volume_name.clone(),
        model: if supported {
            "XIAO BLE".to_string()
        } else {
            "UF2 bootloader".to_string()
        },
        kind: DeviceKind::Bootloader,
        status,
        status_label: if supported {
            "Ready to write".to_string()
        } else {
            "Unsupported".to_string()
        },
        supported,
        can_flash: supported,
        can_enter_bootloader: false,
        mount_path: Some(path.display().to_string()),
        port_name: None,
        vendor_id,
        product_id,
        serial_number: None,
        location_id: None,
        detail: Some(path.display().to_string()),
    })
}

fn scan_serial_devices() -> Vec<DeviceInfo> {
    let Ok(ports) = serialport::available_ports() else {
        return Vec::new();
    };

    ports
        .into_iter()
        .filter_map(|port| match port.port_type {
            SerialPortType::UsbPort(info) => Some(serial_device(port.port_name, info)),
            _ => None,
        })
        .collect()
}

fn serial_device(port_name: String, info: UsbPortInfo) -> DeviceInfo {
    let usb_text = usb_info_text(&info);
    let supported = looks_like_xiao_ble(&usb_text) || looks_like_zmk_candidate(&usb_text);
    let product = info
        .product
        .clone()
        .unwrap_or_else(|| "USB serial device".to_string());
    let model = if looks_like_xiao_ble(&usb_text) {
        "XIAO BLE".to_string()
    } else if supported {
        "XIAO BLE candidate".to_string()
    } else {
        "USB serial".to_string()
    };

    DeviceInfo {
        id: format!("serial:{port_name}"),
        label: product,
        model,
        kind: DeviceKind::Serial,
        status: if supported {
            DeviceStatus::AppMode
        } else {
            DeviceStatus::Unsupported
        },
        status_label: if supported {
            "App mode".to_string()
        } else {
            "Unsupported".to_string()
        },
        supported,
        can_flash: false,
        can_enter_bootloader: supported,
        mount_path: None,
        port_name: Some(port_name.clone()),
        vendor_id: Some(info.vid),
        product_id: Some(info.pid),
        serial_number: info.serial_number.clone(),
        location_id: None,
        detail: Some(format!(
            "{} · VID {:04x} PID {:04x}",
            port_name, info.vid, info.pid
        )),
    }
}

fn scan_usb_devices() -> Vec<DeviceInfo> {
    #[cfg(target_os = "macos")]
    {
        scan_macos_usb_devices()
    }

    #[cfg(not(target_os = "macos"))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "macos")]
fn scan_macos_usb_devices() -> Vec<DeviceInfo> {
    let Ok(output) = ProcessCommand::new("/usr/sbin/ioreg")
        .args(["-p", "IOUSB", "-l", "-w", "0"])
        .output()
    else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let text = String::from_utf8_lossy(&output.stdout);
    parse_macos_usb_devices(&text)
        .into_iter()
        .filter_map(usb_device_info)
        .collect()
}

#[cfg(target_os = "macos")]
fn parse_macos_usb_devices(text: &str) -> Vec<MacUsbDevice> {
    let mut devices = Vec::new();
    let mut current: Option<MacUsbDevice> = None;

    for line in text.lines() {
        if line.contains("<class IOUSBHostDevice") {
            if let Some(device) = current.take() {
                devices.push(device);
            }
            current = Some(MacUsbDevice::default());
            continue;
        }

        let Some(device) = current.as_mut() else {
            continue;
        };

        let trimmed = ioreg_trimmed_line(line);
        if trimmed == "}" {
            if let Some(device) = current.take() {
                devices.push(device);
            }
            continue;
        }

        if let Some(value) = ioreg_string_value(trimmed, "USB Vendor Name")
            .or_else(|| ioreg_string_value(trimmed, "kUSBVendorString"))
        {
            device.vendor_name = Some(value);
        } else if let Some(value) = ioreg_string_value(trimmed, "USB Product Name")
            .or_else(|| ioreg_string_value(trimmed, "kUSBProductString"))
        {
            device.product_name = Some(value);
        } else if let Some(value) = ioreg_string_value(trimmed, "USB Serial Number")
            .or_else(|| ioreg_string_value(trimmed, "kUSBSerialNumberString"))
        {
            device.serial_number = Some(value);
        } else if let Some(value) = ioreg_u32_value(trimmed, "idVendor") {
            device.vendor_id = Some(value as u16);
        } else if let Some(value) = ioreg_u32_value(trimmed, "idProduct") {
            device.product_id = Some(value as u16);
        } else if let Some(value) = ioreg_u32_value(trimmed, "locationID") {
            device.location_id = Some(value);
        }
    }

    if let Some(device) = current {
        devices.push(device);
    }

    devices
}

fn usb_device_info(device: MacUsbDevice) -> Option<DeviceInfo> {
    let vendor_name = device.vendor_name.as_deref().unwrap_or_default();
    let product_name = device.product_name.as_deref().unwrap_or_default();
    let serial_number = device.serial_number.as_deref().unwrap_or_default();
    let usb_text = format!(
        "{vendor_name}\n{product_name}\n{serial_number}\n{:04x}\n{:04x}",
        device.vendor_id.unwrap_or_default(),
        device.product_id.unwrap_or_default()
    );
    let supported = looks_like_xiao_ble(&usb_text) || looks_like_zmk_candidate(&usb_text);
    if !supported {
        return None;
    }

    let label = if product_name.is_empty() {
        "ZMK keyboard".to_string()
    } else {
        product_name.to_string()
    };
    let detail = format!(
        "{} · VID {:04x} PID {:04x}",
        vendor_name,
        device.vendor_id.unwrap_or_default(),
        device.product_id.unwrap_or_default()
    );

    Some(DeviceInfo {
        id: format!(
            "usb:{}:{}:{}",
            device.location_id.unwrap_or_default(),
            device.vendor_id.unwrap_or_default(),
            device.product_id.unwrap_or_default()
        ),
        label,
        model: if looks_like_xiao_ble(&usb_text) {
            "XIAO BLE".to_string()
        } else {
            "ZMK keyboard".to_string()
        },
        kind: DeviceKind::Usb,
        status: DeviceStatus::BootloaderRequired,
        status_label: "Bootloader needed".to_string(),
        supported,
        can_flash: false,
        can_enter_bootloader: false,
        mount_path: None,
        port_name: None,
        vendor_id: device.vendor_id,
        product_id: device.product_id,
        serial_number: device.serial_number,
        location_id: device.location_id,
        detail: Some(detail),
    })
}

fn ioreg_string_value(line: &str, key: &str) -> Option<String> {
    let prefix = format!("\"{key}\" = ");
    let value = line.strip_prefix(&prefix)?;
    value
        .trim()
        .strip_prefix('"')?
        .strip_suffix('"')
        .map(ToString::to_string)
}

fn ioreg_trimmed_line(line: &str) -> &str {
    let mut trimmed = line.trim();
    while let Some(next) = trimmed.strip_prefix('|') {
        trimmed = next.trim_start();
    }
    trimmed
}

fn ioreg_u32_value(line: &str, key: &str) -> Option<u32> {
    let prefix = format!("\"{key}\" = ");
    let value = line.strip_prefix(&prefix)?.trim();
    if let Some(hex) = value.strip_prefix("0x") {
        u32::from_str_radix(hex, 16).ok()
    } else {
        value.parse().ok()
    }
}

fn usb_info_text(info: &UsbPortInfo) -> String {
    format!(
        "{}\n{}\n{}\n{:04x}\n{:04x}",
        info.manufacturer.as_deref().unwrap_or_default(),
        info.product.as_deref().unwrap_or_default(),
        info.serial_number.as_deref().unwrap_or_default(),
        info.vid,
        info.pid
    )
}

fn looks_like_xiao_ble(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    let xiao_name = lower.contains("xiao") && (lower.contains("ble") || lower.contains("nrf52840"));
    let seeed_nrf = lower.contains("seeed") && lower.contains("nrf52840");
    let seeed_vid = lower.contains("2886");
    xiao_name || seeed_nrf || seeed_vid
}

fn looks_like_zmk_candidate(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("zmk") || lower.contains("broccoli")
}

fn fetch_latest_release_sync() -> Result<ReleaseInfo, String> {
    let client = http_client()?;
    let response = client
        .get(RELEASE_URL)
        .send()
        .map_err(|error| format!("Failed to request GitHub release: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "GitHub release request failed: {}",
            response.status()
        ));
    }

    let release: GitHubRelease = response
        .json()
        .map_err(|error| format!("Failed to parse GitHub release: {error}"))?;
    let mut assets = Vec::new();
    for asset in release.assets {
        let lower_name = asset.name.to_ascii_lowercase();
        if lower_name.ends_with(".uf2") {
            assets.push(FirmwareAsset {
                id: asset.id.to_string(),
                name: asset.name.clone(),
                size: asset.size,
                download_url: asset.browser_download_url,
                source_asset_id: asset.id,
                source_asset_name: asset.name,
                archive_entry: None,
            });
            continue;
        }

        if lower_name.ends_with(".zip") {
            assets.extend(list_uf2_assets_in_zip(&release.tag_name, &asset)?);
        }
    }

    if assets.is_empty() {
        return Err("No UF2 firmware asset was found in the latest release.".to_string());
    }

    Ok(ReleaseInfo {
        tag_name: release.tag_name,
        name: release.name,
        html_url: release.html_url,
        published_at: release.published_at,
        assets,
    })
}

fn flash_device_sync(device_id: &str, asset_id: String) -> Result<FlashResult, String> {
    let release = fetch_latest_release_sync()?;
    let asset = release
        .assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| "Selected firmware asset was not found in the latest release.".to_string())?
        .clone();

    let device = scan_devices_sync()
        .into_iter()
        .find(|device| device.id == device_id)
        .ok_or_else(|| "Selected device is no longer connected.".to_string())?;

    if !device.supported {
        return Err("Selected device is not supported.".to_string());
    }

    if !device.can_flash {
        return Err("Device is not in bootloader mode.".to_string());
    }

    let mount_path = device
        .mount_path
        .clone()
        .ok_or_else(|| "Device is not in bootloader mode.".to_string())?;
    let firmware_path = download_firmware(&release.tag_name, &asset)?;
    let target_path = Path::new(&mount_path).join(&asset.name);

    fs::copy(&firmware_path, &target_path)
        .map_err(|error| format!("Failed to copy firmware to bootloader volume: {error}"))?;
    flush_disk_buffers();

    Ok(FlashResult {
        release_tag: release.tag_name,
        asset_name: asset.name,
        device_label: device.label,
        mount_path,
    })
}

fn list_uf2_assets_in_zip(
    tag_name: &str,
    asset: &GitHubAsset,
) -> Result<Vec<FirmwareAsset>, String> {
    let zip_path =
        download_release_asset(tag_name, asset.id, &asset.name, &asset.browser_download_url)?;
    let zip_file = fs::File::open(&zip_path)
        .map_err(|error| format!("Failed to open firmware archive: {error}"))?;
    let mut archive = ZipArchive::new(zip_file)
        .map_err(|error| format!("Failed to read firmware archive: {error}"))?;
    let mut firmware_assets = Vec::new();

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to read firmware archive entry: {error}"))?;
        if entry.is_dir() || !entry.name().to_ascii_lowercase().ends_with(".uf2") {
            continue;
        }

        let entry_name = entry.name().to_string();
        let display_name = Path::new(&entry_name)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&entry_name)
            .to_string();
        firmware_assets.push(FirmwareAsset {
            id: firmware_entry_id(asset.id, &entry_name),
            name: display_name,
            size: entry.size(),
            download_url: asset.browser_download_url.clone(),
            source_asset_id: asset.id,
            source_asset_name: asset.name.clone(),
            archive_entry: Some(entry_name),
        });
    }

    Ok(firmware_assets)
}

fn download_firmware(tag_name: &str, asset: &FirmwareAsset) -> Result<PathBuf, String> {
    if let Some(entry_name) = &asset.archive_entry {
        return extract_firmware_from_zip(tag_name, asset, entry_name);
    }

    download_release_asset(
        tag_name,
        asset.source_asset_id,
        &asset.name,
        &asset.download_url,
    )
}

fn download_release_asset(
    tag_name: &str,
    asset_id: u64,
    asset_name: &str,
    download_url: &str,
) -> Result<PathBuf, String> {
    let cache_dir = firmware_cache_dir(tag_name)?;
    let path = cache_dir.join(format!(
        "{}-{}",
        asset_id,
        sanitize_path_segment(asset_name)
    ));

    if path.exists() {
        return Ok(path);
    }

    let client = http_client()?;
    let mut response = client
        .get(download_url)
        .send()
        .map_err(|error| format!("Failed to download firmware: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("Firmware download failed: {}", response.status()));
    }

    let mut file = fs::File::create(&path)
        .map_err(|error| format!("Failed to create firmware cache file: {error}"))?;
    response
        .copy_to(&mut file)
        .map_err(|error| format!("Failed to save firmware: {error}"))?;
    file.flush()
        .map_err(|error| format!("Failed to flush firmware cache file: {error}"))?;
    Ok(path)
}

fn extract_firmware_from_zip(
    tag_name: &str,
    asset: &FirmwareAsset,
    entry_name: &str,
) -> Result<PathBuf, String> {
    let zip_path = download_release_asset(
        tag_name,
        asset.source_asset_id,
        &asset.source_asset_name,
        &asset.download_url,
    )?;
    let cache_dir = firmware_cache_dir(tag_name)?;
    let output_path = cache_dir.join(format!(
        "{}-{}",
        asset.id,
        sanitize_path_segment(&asset.name)
    ));

    if output_path.exists() {
        return Ok(output_path);
    }

    let zip_file = fs::File::open(zip_path)
        .map_err(|error| format!("Failed to open firmware archive: {error}"))?;
    let mut archive = ZipArchive::new(zip_file)
        .map_err(|error| format!("Failed to read firmware archive: {error}"))?;
    let mut entry = archive
        .by_name(entry_name)
        .map_err(|error| format!("Selected UF2 was not found in firmware archive: {error}"))?;
    let mut output = fs::File::create(&output_path)
        .map_err(|error| format!("Failed to create extracted firmware file: {error}"))?;
    io::copy(&mut entry, &mut output)
        .map_err(|error| format!("Failed to extract firmware from archive: {error}"))?;
    output
        .flush()
        .map_err(|error| format!("Failed to flush extracted firmware file: {error}"))?;

    Ok(output_path)
}

fn firmware_cache_dir(tag_name: &str) -> Result<PathBuf, String> {
    let cache_dir = std::env::temp_dir()
        .join("zmk-flasher")
        .join(sanitize_path_segment(tag_name));
    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Failed to create firmware cache directory: {error}"))?;
    Ok(cache_dir)
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn sanitize_path_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn firmware_entry_id(source_asset_id: u64, entry_name: &str) -> String {
    format!("{source_asset_id}:{entry_name}")
}

fn flush_disk_buffers() {
    let _ = ProcessCommand::new("sync").status();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_devices,
            fetch_latest_release,
            flash_device
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xiao_ble_uf2_info_is_supported() {
        // Given: XIAO BLE の UF2 情報がある
        let info = "Model: Seeed XIAO nRF52840\nBoard-ID: SEEED_XIAO_NRF52840";

        // When: 対応判定を行う
        let supported = looks_like_xiao_ble(info);

        // Then: 対応デバイスとして扱う
        assert!(supported);
    }

    #[test]
    fn zmk_keyboard_is_candidate() {
        // Given: ZMK キーボードの USB 情報がある
        let info = "ZMK Project\nBroccoli Keyboard";

        // When: 候補判定を行う
        let candidate = looks_like_zmk_candidate(info);

        // Then: XIAO BLE 候補として扱う
        assert!(candidate);
    }

    #[test]
    fn path_segment_replaces_unsafe_characters() {
        // Given: パスに使えない文字を含む名前がある
        let value = "firmware/2026:06:16.uf2";

        // When: パス用に整形する
        let sanitized = sanitize_path_segment(value);

        // Then: 安全な文字だけが残る
        assert_eq!(sanitized, "firmware_2026_06_16.uf2");
    }

    #[test]
    fn firmware_entry_id_is_stable() {
        // Given: 同じ zip entry がある
        let entry_name = "broccoli_left-seeeduino_xiao_ble-zmk.uf2";

        // When: ID を複数回作る
        let first = firmware_entry_id(448561773, entry_name);
        let second = firmware_entry_id(448561773, entry_name);

        // Then: 同じ ID になる
        assert_eq!(first, second);
    }

    #[test]
    fn firmware_entry_id_is_lossless_text() {
        // Given: zip 内 UF2 の名前がある
        let entry_name = "broccoli_left-seeeduino_xiao_ble-zmk.uf2";

        // When: frontend に渡す ID を作る
        let id = firmware_entry_id(448561773, entry_name);

        // Then: GitHub asset ID と zip entry 名が文字列で残る
        assert_eq!(id, "448561773:broccoli_left-seeeduino_xiao_ble-zmk.uf2");
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn macos_ioreg_zmk_device_is_detected() {
        // Given: ZMK 書き込み済み device の ioreg 出力がある
        let text = r#"
  | +-o IOUSBHostDevice@01100000  <class IOUSBHostDevice, id 0x100052f66, registered, matched, active, busy 0 (5 ms), retain 20>
  |     {
  |       "idProduct" = 24926
  |       "USB Vendor Name" = "ZMK Project"
  |       "idVendor" = 7504
  |       "USB Serial Number" = "6C573C3673E50A39"
  |       "locationID" = 17825792
  |       "kUSBVendorString" = "ZMK Project"
  |     }
"#;

        // When: macOS USB device を抽出する
        let devices = parse_macos_usb_devices(text);
        let info = usb_device_info(devices.into_iter().next().unwrap()).unwrap();

        // Then: bootloader が必要な ZMK keyboard として扱う
        assert!(info.supported);
        assert!(!info.can_flash);
        assert_eq!(info.status_label, "Bootloader needed");
    }

    #[test]
    fn bootloader_device_hides_same_product_usb_and_serial_devices() {
        // Given: 同じ XIAO BLE が複数の USB 表現で見えている
        let bootloader = test_device(DeviceKind::Bootloader, "volume:XIAO-SENSE", true);
        let serial = test_device(DeviceKind::Serial, "serial:/dev/cu.usbmodem1101", false);
        let usb = test_device(DeviceKind::Usb, "usb:17825792:10374:69", false);

        // When: device 一覧を整理する
        let devices = dedupe_devices(vec![serial, bootloader, usb]);

        // Then: 書き込み可能な bootloader だけを残す
        assert_eq!(devices.len(), 1);
        assert!(matches!(devices[0].kind, DeviceKind::Bootloader));
    }

    #[test]
    fn cu_serial_device_hides_tty_serial_twin() {
        // Given: macOS の cu と tty serial port が同じ device を指している
        let cu = test_serial_device("/dev/cu.usbmodem1101");
        let tty = test_serial_device("/dev/tty.usbmodem1101");

        // When: device 一覧を整理する
        let devices = dedupe_devices(vec![tty, cu]);

        // Then: cu 側だけを残す
        assert_eq!(devices.len(), 1);
        assert_eq!(
            devices[0].port_name.as_deref(),
            Some("/dev/cu.usbmodem1101")
        );
    }

    fn test_serial_device(port_name: &str) -> DeviceInfo {
        let mut device = test_device(DeviceKind::Serial, &format!("serial:{port_name}"), false);
        device.port_name = Some(port_name.to_string());
        device
    }

    fn test_device(kind: DeviceKind, id: &str, can_flash: bool) -> DeviceInfo {
        DeviceInfo {
            id: id.to_string(),
            label: "XIAO nRF52840 Sense".to_string(),
            model: "XIAO BLE".to_string(),
            kind,
            status: if can_flash {
                DeviceStatus::BootloaderReady
            } else {
                DeviceStatus::AppMode
            },
            status_label: if can_flash {
                "Ready to write".to_string()
            } else {
                "App mode".to_string()
            },
            supported: true,
            can_flash,
            can_enter_bootloader: false,
            mount_path: can_flash.then(|| "/Volumes/XIAO-SENSE".to_string()),
            port_name: None,
            vendor_id: Some(0x2886),
            product_id: Some(0x0045),
            serial_number: Some("6C573C3673E50A39".to_string()),
            location_id: Some(17_825_792),
            detail: None,
        }
    }
}
