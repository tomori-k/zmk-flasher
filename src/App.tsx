import {
  CheckCircle2,
  Cpu,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Usb,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { backendInvoke } from "./backend";

type DeviceStatus = "bootloader_ready" | "app_mode" | "bootloader_required" | "unsupported" | "unknown";

type DeviceInfo = {
  id: string;
  label: string;
  model: string;
  kind: "bootloader" | "serial" | "usb" | "unknown";
  status: DeviceStatus;
  status_label: string;
  supported: boolean;
  can_flash: boolean;
  can_enter_bootloader: boolean;
  mount_path?: string;
  port_name?: string;
  vendor_id?: number;
  product_id?: number;
  serial_number?: string;
  location_id?: number;
  detail?: string;
};

type FirmwareAsset = {
  id: string;
  name: string;
  size: number;
  download_url: string;
};

type ReleaseInfo = {
  tag_name: string;
  name?: string;
  html_url: string;
  published_at?: string;
  assets: FirmwareAsset[];
};

type FlashResult = {
  release_tag: string;
  asset_name: string;
  device_label: string;
  mount_path: string;
};

type AppMessage = {
  tone: "info" | "success" | "error";
  text: string;
};

const deviceScanIntervalMs = 1000;

const statusTone: Record<DeviceStatus, string> = {
  bootloader_ready: "border-mint/30 bg-mint/10 text-mint",
  app_mode: "border-brass/30 bg-brass/10 text-brass",
  bootloader_required: "border-brass/30 bg-brass/10 text-brass",
  unsupported: "border-coral/30 bg-coral/10 text-coral",
  unknown: "border-line bg-white text-ink/70",
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function App() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [message, setMessage] = useState<AppMessage | null>(null);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );
  const selectedAsset = useMemo(
    () => release?.assets.find((asset) => asset.id === selectedAssetId),
    [release, selectedAssetId],
  );

  const refreshDevices = useCallback(async (silent = false) => {
    if (!silent) setScanning(true);
    try {
      const nextDevices = await backendInvoke<DeviceInfo[]>("scan_devices");
      setDevices(nextDevices);
      setSelectedDeviceId((current) => {
        if (current && nextDevices.some((device) => device.id === current)) return current;
        return nextDevices.find((device) => device.supported)?.id ?? nextDevices[0]?.id ?? "";
      });
    } catch (error) {
      setMessage({ tone: "error", text: `Device scan failed: ${String(error)}` });
    } finally {
      if (!silent) setScanning(false);
    }
  }, []);

  const refreshRelease = useCallback(async () => {
    setLoadingRelease(true);
    try {
      const nextRelease = await backendInvoke<ReleaseInfo>("fetch_latest_release");
      setRelease(nextRelease);
      setSelectedAssetId((current) => {
        if (current && nextRelease.assets.some((asset) => asset.id === current)) return current;
        return nextRelease.assets[0]?.id ?? null;
      });
    } catch (error) {
      setMessage({ tone: "error", text: `Firmware refresh failed: ${String(error)}` });
    } finally {
      setLoadingRelease(false);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    void refreshRelease();
  }, [refreshDevices, refreshRelease]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshDevices(true);
    }, deviceScanIntervalMs);
    return () => window.clearInterval(timer);
  }, [refreshDevices]);

  const flashSelectedDevice = async () => {
    if (!selectedDevice || !selectedAsset) {
      setMessage({ tone: "error", text: "Device and firmware are required." });
      return;
    }
    setFlashing(true);
    setMessage({
      tone: "info",
      text:
        selectedDevice.status === "bootloader_ready"
          ? "Writing firmware..."
          : "Device is not in bootloader mode.",
    });
    try {
      const result = await backendInvoke<FlashResult>("flash_device", {
        deviceId: selectedDevice.id,
        assetId: selectedAsset.id,
      });
      setMessage({
        tone: "success",
        text: `Wrote ${result.asset_name} to ${result.device_label}.`,
      });
      await refreshDevices(true);
    } catch (error) {
      setMessage({ tone: "error", text: `Flash failed: ${String(error)}` });
    } finally {
      setFlashing(false);
    }
  };

  const readyToFlash = Boolean(selectedDevice?.can_flash && selectedAsset && !flashing);

  return (
    <main className="min-h-screen bg-panel text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">ZMK Flasher</p>
            <h1 className="mt-1 text-3xl font-semibold">Broccoli firmware writer</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="icon-button"
              onClick={() => void refreshDevices()}
              disabled={scanning}
              title="Scan devices"
              type="button"
            >
              {scanning ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            </button>
            <button
              className="icon-button"
              onClick={() => void refreshRelease()}
              disabled={loadingRelease}
              title="Refresh firmware"
              type="button"
            >
              {loadingRelease ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Devices</h2>
              <span className="text-sm text-ink/60">{devices.length} found</span>
            </div>

            {devices.length === 0 ? (
              <div className="empty-state">
                <Usb size={28} />
                <p>No supported device detected.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {devices.map((device) => (
                  <button
                    key={device.id}
                    className={`device-row ${selectedDeviceId === device.id ? "device-row-selected" : ""}`}
                    onClick={() => setSelectedDeviceId(device.id)}
                    type="button"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-md bg-white text-ink shadow-sm">
                      {device.kind === "bootloader" ? (
                        <HardDrive size={22} />
                      ) : device.kind === "usb" ? (
                        <Usb size={22} />
                      ) : (
                        <Cpu size={22} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-base font-semibold">{device.label}</span>
                      <span className="mt-1 block truncate text-sm text-ink/60">
                        {device.detail ?? device.model}
                      </span>
                    </span>
                    <span className={`status-pill ${statusTone[device.status]}`}>{device.status_label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="tool-panel">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Firmware</h2>
                {loadingRelease && <Loader2 className="animate-spin text-ink/50" size={18} />}
              </div>
              {release ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-md border border-line bg-white p-3">
                    <p className="truncate text-sm font-semibold">{release.tag_name}</p>
                    <p className="mt-1 text-xs text-ink/60">{formatDate(release.published_at)}</p>
                  </div>
                  <label className="block text-sm font-medium text-ink/70" htmlFor="asset">
                    Asset
                  </label>
                  <select
                    className="select-field"
                    id="asset"
                    value={selectedAssetId ?? ""}
                    onChange={(event) => setSelectedAssetId(event.target.value)}
                  >
                    {release.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} · {formatBytes(asset.size)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="empty-state mt-4 min-h-32">
                  <Download size={24} />
                  <p>Firmware is not loaded.</p>
                </div>
              )}
            </section>

            <section className="tool-panel">
              <h2 className="text-lg font-semibold">Write</h2>
              <div className="mt-4 space-y-3 text-sm text-ink/70">
                <div className="summary-row">
                  <span>Device</span>
                  <strong>{selectedDevice?.label ?? "none"}</strong>
                </div>
                <div className="summary-row">
                  <span>Status</span>
                  <strong>{selectedDevice?.status_label ?? "not ready"}</strong>
                </div>
                <div className="summary-row">
                  <span>Firmware</span>
                  <strong>{selectedAsset?.name ?? "none"}</strong>
                </div>
              </div>
              {selectedDevice?.supported && !selectedDevice.can_flash && (
                <p className="mt-4 rounded-md border border-brass/30 bg-brass/10 px-3 py-2 text-sm font-medium text-brass">
                  Bootloader mode is required.
                </p>
              )}
              <button
                className="primary-button mt-5"
                disabled={!readyToFlash}
                onClick={() => void flashSelectedDevice()}
                type="button"
              >
                {flashing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                <span>Write firmware</span>
              </button>
            </section>
          </aside>
        </section>

        {message && (
          <div className={messageClassName(message.tone)} role="status">
            {message.tone === "success" ? <CheckCircle2 size={18} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;

function messageClassName(tone: AppMessage["tone"]) {
  if (tone === "success") return "message-bar message-success";
  if (tone === "error") return "message-bar message-error";
  return "message-bar message-info";
}
