import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Download,
  HardDrive,
  Info,
  Loader2,
  RefreshCw,
  Usb,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  id: number;
  tone: "info" | "success" | "error";
  text: string;
  persistent?: boolean;
};

type FirmwareKind = "left" | "right" | "reset" | "custom";

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

function firmwareKind(name: string): FirmwareKind {
  const normalized = name.toLowerCase();
  if (/(^|[-_\s])reset([-_.\s]|$)/.test(normalized)) return "reset";
  if (/(^|[-_\s])left([-_.\s]|$)/.test(normalized)) return "left";
  if (/(^|[-_\s])right([-_.\s]|$)/.test(normalized)) return "right";
  return "custom";
}

function firmwareLabel(asset: FirmwareAsset) {
  const kind = firmwareKind(asset.name);
  if (kind === "left") return "Left";
  if (kind === "right") return "Right";
  if (kind === "reset") return "Reset";
  return "Custom";
}

function firmwareOrder(asset: FirmwareAsset) {
  const order: Record<FirmwareKind, number> = {
    left: 0,
    right: 1,
    reset: 2,
    custom: 3,
  };
  return order[firmwareKind(asset.name)];
}

function sortFirmwareAssets(assets: FirmwareAsset[]) {
  return [...assets].sort(
    (first, second) =>
      firmwareOrder(first) - firmwareOrder(second) || first.name.localeCompare(second.name),
  );
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
  const messageIdRef = useRef(0);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );
  const selectedAsset = useMemo(
    () => release?.assets.find((asset) => asset.id === selectedAssetId),
    [release, selectedAssetId],
  );
  const firmwareAssets = useMemo(() => (release ? sortFirmwareAssets(release.assets) : []), [release]);

  const showMessage = useCallback((nextMessage: Omit<AppMessage, "id">) => {
    messageIdRef.current += 1;
    setMessage({ id: messageIdRef.current, ...nextMessage });
  }, []);

  useEffect(() => {
    if (!message || message.persistent) return;
    const timer = window.setTimeout(() => {
      setMessage((current) => (current?.id === message.id ? null : current));
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

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
      showMessage({ tone: "error", text: `Device scan failed: ${String(error)}` });
    } finally {
      if (!silent) setScanning(false);
    }
  }, [showMessage]);

  const refreshRelease = useCallback(async () => {
    setLoadingRelease(true);
    try {
      const nextRelease = await backendInvoke<ReleaseInfo>("fetch_latest_release");
      setRelease(nextRelease);
      setSelectedAssetId((current) => {
        if (current && nextRelease.assets.some((asset) => asset.id === current)) return current;
        return sortFirmwareAssets(nextRelease.assets)[0]?.id ?? null;
      });
    } catch (error) {
      showMessage({ tone: "error", text: `Firmware refresh failed: ${String(error)}` });
    } finally {
      setLoadingRelease(false);
    }
  }, [showMessage]);

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
      showMessage({ tone: "error", text: "Device and firmware are required." });
      return;
    }
    setFlashing(true);
    showMessage({
      tone: "info",
      text:
        selectedDevice.status === "bootloader_ready"
          ? "Writing firmware..."
          : "Device is not in bootloader mode.",
      persistent: true,
    });
    try {
      const result = await backendInvoke<FlashResult>("flash_device", {
        deviceId: selectedDevice.id,
        assetId: selectedAsset.id,
      });
      showMessage({
        tone: "success",
        text: `Wrote ${result.asset_name} to ${result.device_label}.`,
      });
      await refreshDevices(true);
    } catch (error) {
      showMessage({ tone: "error", text: `Flash failed: ${String(error)}` });
    } finally {
      setFlashing(false);
    }
  };

  const readyToFlash = Boolean(selectedDevice?.can_flash && selectedAsset && !flashing);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-panel text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 pb-56 pt-4 sm:px-5 sm:pb-36 lg:pb-28">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <div className="section-heading">
              <div>
                <h2>Devices</h2>
                <p>{devices.length} found</p>
              </div>
              <button
                className="icon-button"
                onClick={() => void refreshDevices()}
                disabled={scanning}
                title="Scan devices"
                type="button"
              >
                {scanning ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
              </button>
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
                    aria-pressed={selectedDeviceId === device.id}
                    className={`device-row ${selectedDeviceId === device.id ? "choice-row-selected" : ""}`}
                    onClick={() => setSelectedDeviceId(device.id)}
                    type="button"
                  >
                    <span className="choice-icon">
                      {device.kind === "bootloader" ? (
                        <HardDrive size={22} />
                      ) : device.kind === "usb" ? (
                        <Usb size={22} />
                      ) : (
                        <Cpu size={22} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="block truncate text-base font-semibold">{device.label}</span>
                        {selectedDeviceId === device.id && (
                          <CheckCircle2 className="shrink-0 text-mint" size={18} />
                        )}
                      </span>
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
            <section className="space-y-4">
              <div className="section-heading">
                <div>
                  <h2>Firmware</h2>
                  <p>{release ? `${release.tag_name} · ${formatDate(release.published_at)}` : "not loaded"}</p>
                </div>
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
              {release ? (
                <div className="grid gap-3">
                  {firmwareAssets.map((asset) => {
                    const kind = firmwareKind(asset.name);
                    const selected = selectedAssetId === asset.id;
                    return (
                      <button
                        key={asset.id}
                        aria-pressed={selected}
                        className={`firmware-option ${selected ? "choice-row-selected" : ""}`}
                        onClick={() => setSelectedAssetId(asset.id)}
                        title={asset.name}
                        type="button"
                      >
                        <span className={`firmware-badge firmware-badge-${kind}`}>{firmwareLabel(asset)}</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-semibold">{asset.name}</span>
                          <span className="mt-1 block text-xs text-ink/55">{formatBytes(asset.size)}</span>
                        </span>
                        {selected && <CheckCircle2 className="shrink-0 text-mint" size={18} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state mt-4 min-h-32">
                  <Download size={24} />
                  <p>Firmware is not loaded.</p>
                </div>
              )}
            </section>
          </aside>
        </section>

        {message && (
          <div className={messageClassName(message.tone)} role={message.tone === "error" ? "alert" : "status"}>
            {message.tone === "success" ? (
              <CheckCircle2 size={18} />
            ) : message.tone === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Info size={18} />
            )}
            <span>{message.text}</span>
            <button className="toast-close" onClick={() => setMessage(null)} title="Dismiss" type="button">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <section className="write-bar" aria-label="Write firmware">
        <div className="write-bar-inner">
          <div className="write-summary">
            <div className="write-summary-item">
              <span>Device</span>
              <strong>{selectedDevice?.label ?? "none"}</strong>
            </div>
            <div className="write-summary-item">
              <span>Status</span>
              <strong>{selectedDevice?.status_label ?? "not ready"}</strong>
            </div>
            <div className="write-summary-item">
              <span>Firmware</span>
              <strong>{selectedAsset ? firmwareLabel(selectedAsset) : "none"}</strong>
            </div>
          </div>
          {selectedDevice?.supported && !selectedDevice.can_flash && (
            <p className="write-note">Bootloader mode is required.</p>
          )}
          <button
            className="primary-button"
            disabled={!readyToFlash}
            onClick={() => void flashSelectedDevice()}
            type="button"
          >
            {flashing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
            <span>Write firmware</span>
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;

function messageClassName(tone: AppMessage["tone"]) {
  if (tone === "success") return "message-bar message-success";
  if (tone === "error") return "message-bar message-error";
  return "message-bar message-info";
}
