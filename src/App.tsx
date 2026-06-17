import {
  CheckCircle2,
  Cpu,
  FileText,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Usb,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

type Locale = "ja" | "en";
type FirmwareKind = "left" | "right" | "reset" | "custom";

const deviceScanIntervalMs = 1000;
const localeStorageKey = "zmk-flasher-locale";

const messages = {
  en: {
    bootloaderRequired: "Bootloader mode is required.",
    custom: "Custom",
    device: "Device",
    deviceAndFirmwareRequired: "Device and firmware are required.",
    deviceScanFailed: "Device scan failed",
    devices: "Devices",
    firmware: "Firmware",
    firmwareNotLoaded: "Firmware is not loaded.",
    firmwareRefreshFailed: "Firmware refresh failed",
    firmwareSide: "Firmware",
    firmwareWritten: "Firmware written",
    flashFailed: "Flash failed",
    language: "Language",
    noFirmwareSelected: "No firmware selected",
    noMatchingDevice: "No matching device.",
    noSupportedDevice: "No supported device detected.",
    none: "none",
    notLoaded: "not loaded",
    notReady: "not ready",
    refreshFirmware: "Refresh firmware",
    releaseNotLoaded: "Release not loaded",
    searchDevices: "Search devices",
    status: "Status",
    writeFirmware: "Write firmware",
    writeOptions: "Write options",
    writeSettings: "Write settings",
    writingFirmware: "Writing firmware...",
    found: (count: number) => `${count} found`,
    wroteFirmware: (assetName: string, deviceLabel: string) =>
      `Wrote ${assetName} to ${deviceLabel}.`,
  },
  ja: {
    bootloaderRequired: "ブートローダーモードが必要です。",
    custom: "カスタム",
    device: "デバイス",
    deviceAndFirmwareRequired: "デバイスとファームウェアを選択してください。",
    deviceScanFailed: "デバイスのスキャンに失敗しました",
    devices: "デバイス",
    firmware: "ファームウェア",
    firmwareNotLoaded: "ファームウェアが未読込です。",
    firmwareRefreshFailed: "ファームウェア更新に失敗しました",
    firmwareSide: "ファーム",
    firmwareWritten: "ファームウェアを書き込みました",
    flashFailed: "書き込みに失敗しました",
    language: "言語",
    noFirmwareSelected: "ファームウェア未選択",
    noMatchingDevice: "一致するデバイスはありません。",
    noSupportedDevice: "対応デバイスが見つかりません。",
    none: "なし",
    notLoaded: "未読込",
    notReady: "未準備",
    refreshFirmware: "ファームウェア更新",
    releaseNotLoaded: "リリース未読込",
    searchDevices: "デバイスを検索",
    status: "状態",
    writeFirmware: "書き込む",
    writeOptions: "書き込みオプション",
    writeSettings: "書き込み設定",
    writingFirmware: "書き込み中...",
    found: (count: number) => `${count} 件`,
    wroteFirmware: (assetName: string, deviceLabel: string) =>
      `${deviceLabel} に ${assetName} を書き込みました。`,
  },
} as const;

const firmwareKindLabels: Record<Locale, Record<FirmwareKind, string>> = {
  en: {
    left: "Left",
    right: "Right",
    reset: "Reset",
    custom: "Custom",
  },
  ja: {
    left: "左",
    right: "右",
    reset: "リセット",
    custom: "カスタム",
  },
};

const deviceStatusLabels: Record<Locale, Record<DeviceStatus, string>> = {
  en: {
    bootloader_ready: "ready",
    app_mode: "app mode",
    bootloader_required: "bootloader needed",
    unsupported: "unsupported",
    unknown: "unknown",
  },
  ja: {
    bootloader_ready: "書き込み可能",
    app_mode: "通常モード",
    bootloader_required: "ブートローダーが必要",
    unsupported: "非対応",
    unknown: "不明",
  },
};

const statusDotTone: Record<DeviceStatus, string> = {
  bootloader_ready: "bg-primary",
  app_mode: "bg-amber-400",
  bootloader_required: "bg-amber-400",
  unsupported: "bg-destructive",
  unknown: "bg-muted-foreground/35",
};

const firmwareTone: Record<FirmwareKind, string> = {
  left: "border-emerald-200 bg-emerald-50 text-emerald-700",
  right: "border-sky-200 bg-sky-50 text-sky-700",
  reset: "border-rose-200 bg-rose-50 text-rose-700",
  custom: "border-border bg-muted text-muted-foreground",
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | undefined, locale: Locale) {
  if (!value) return messages[locale].notLoaded;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const storedLocale = window.localStorage.getItem(localeStorageKey);
  if (storedLocale === "ja" || storedLocale === "en") return storedLocale;
  return window.navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

function firmwareKind(name: string): FirmwareKind {
  const normalized = name.toLowerCase();
  if (/(^|[-_\s])reset([-_.\s]|$)/.test(normalized)) return "reset";
  if (/(^|[-_\s])left([-_.\s]|$)/.test(normalized)) return "left";
  if (/(^|[-_\s])right([-_.\s]|$)/.test(normalized)) return "right";
  return "custom";
}

function firmwareLabel(asset: FirmwareAsset, locale: Locale) {
  const kind = firmwareKind(asset.name);
  return firmwareKindLabels[locale][kind];
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

function deviceSearchText(device: DeviceInfo) {
  return [
    device.label,
    device.model,
    device.detail,
    device.mount_path,
    device.port_name,
    device.serial_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const t = messages[locale];

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );
  const selectedAsset = useMemo(
    () => release?.assets.find((asset) => asset.id === selectedAssetId),
    [release, selectedAssetId],
  );
  const firmwareAssets = useMemo(() => (release ? sortFirmwareAssets(release.assets) : []), [release]);
  const visibleDevices = useMemo(() => {
    const query = deviceSearch.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) => deviceSearchText(device).includes(query));
  }, [deviceSearch, devices]);

  const refreshDevices = useCallback(async (silent = false) => {
    if (!silent) setScanning(true);
    try {
      const nextDevices = await backendInvoke<DeviceInfo[]>("scan_devices");
      setDevices(nextDevices);
      setSelectedDeviceId((current) => {
        if (current && nextDevices.some((device) => device.id === current && device.can_flash)) {
          return current;
        }
        return nextDevices.find((device) => device.can_flash)?.id ?? "";
      });
    } catch (error) {
      toast.error(t.deviceScanFailed, { description: String(error) });
    } finally {
      if (!silent) setScanning(false);
    }
  }, [t]);

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
      toast.error(t.firmwareRefreshFailed, { description: String(error) });
    } finally {
      setLoadingRelease(false);
    }
  }, [t]);

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
      toast.error(t.deviceAndFirmwareRequired);
      return;
    }
    if (!selectedDevice.can_flash) {
      toast.warning(t.bootloaderRequired);
      return;
    }

    setFlashing(true);
    const toastId = toast.loading(t.writingFirmware, {
      description: `${firmwareLabel(selectedAsset, locale)} / ${selectedDevice.label}`,
    });
    try {
      const result = await backendInvoke<FlashResult>("flash_device", {
        deviceId: selectedDevice.id,
        assetId: selectedAsset.id,
      });
      toast.success(t.firmwareWritten, {
        id: toastId,
        description: t.wroteFirmware(result.asset_name, result.device_label),
      });
      await refreshDevices(true);
    } catch (error) {
      toast.error(t.flashFailed, { id: toastId, description: String(error) });
    } finally {
      setFlashing(false);
    }
  };

  const readyToFlash = Boolean(selectedDevice?.can_flash && selectedAsset && !flashing);

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 min-w-0 flex-col border-r bg-muted/25 px-5 py-5" aria-labelledby="devices-title">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="devices-title" className="truncate text-base font-semibold">
                  {t.devices}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.found(devices.length)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {scanning && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
                <div className="flex rounded-md border bg-background p-0.5" aria-label={t.language}>
                  {(["ja", "en"] as const).map((nextLocale) => (
                    <Button
                      className="h-7 px-2 text-xs shadow-none"
                      key={nextLocale}
                      onClick={() => setLocale(nextLocale)}
                      size="xs"
                      type="button"
                      variant={locale === nextLocale ? "secondary" : "ghost"}
                    >
                      {nextLocale === "ja" ? "JA" : "EN"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <label className="mt-4 flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground shadow-sm focus-within:ring-2 focus-within:ring-ring">
              <Search className="size-4 shrink-0" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                onChange={(event) => setDeviceSearch(event.target.value)}
                placeholder={t.searchDevices}
                value={deviceSearch}
              />
            </label>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {devices.length === 0 ? (
                <Alert className="grid min-h-44 place-items-center border-dashed bg-background/65 text-center">
                  <div className="space-y-3 text-muted-foreground">
                    <Usb className="mx-auto size-7" />
                    <AlertDescription className="font-medium">
                      {t.noSupportedDevice}
                    </AlertDescription>
                  </div>
                </Alert>
              ) : visibleDevices.length === 0 ? (
                <Alert className="grid min-h-32 place-items-center border-dashed bg-background/65 text-center">
                  <AlertDescription className="font-medium">{t.noMatchingDevice}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {visibleDevices.map((device) => {
                    const selected = selectedDeviceId === device.id && device.can_flash;
                    return (
                      <button
                        key={device.id}
                        aria-disabled={!device.can_flash}
                        aria-pressed={selected}
                        className={cn(
                          "relative flex min-h-20 w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg px-4 py-3 text-left transition-colors",
                          device.can_flash ? "hover:bg-background/80" : "cursor-not-allowed opacity-65",
                          selected ? "bg-emerald-50 shadow-sm ring-1 ring-primary/10" : "bg-transparent",
                        )}
                        disabled={!device.can_flash}
                        onClick={() => setSelectedDeviceId(device.id)}
                        type="button"
                      >
                        {selected && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-primary" />}
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground transition-colors",
                            selected && "border-primary/40 bg-primary/10 text-primary",
                          )}
                        >
                          {device.kind === "bootloader" ? (
                            <HardDrive className="size-5" />
                          ) : device.kind === "usb" ? (
                            <Usb className="size-5" />
                          ) : (
                            <Cpu className="size-5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{device.label}</span>
                            {selected && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                          </span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">
                            {device.detail ?? device.model}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            statusDotTone[device.status],
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </aside>

          <section className="min-h-0 min-w-0 bg-background px-6 py-6 lg:px-8">
            <div className="mx-auto flex h-full min-h-0 max-w-4xl flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{t.writeSettings}</h2>
                  </div>
                  <Button
                    className="gap-2"
                    disabled={loadingRelease}
                    onClick={() => void refreshRelease()}
                    variant="outline"
                  >
                    {loadingRelease ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    <span>{t.refreshFirmware}</span>
                  </Button>
                </div>

                <div className="mt-6 pb-4">
                  <section className="space-y-3" aria-labelledby="firmware-title">
                    <h3 id="firmware-title" className="text-base font-semibold">
                      {t.firmware}
                    </h3>

                    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
                      <div className="flex min-h-14 items-center gap-4 px-4 py-3">
                        <FileText className="size-6 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {selectedAsset ? firmwareLabel(selectedAsset, locale) : t.noFirmwareSelected}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {selectedAsset?.name ?? t.notLoaded}
                          </p>
                        </div>
                        <Badge className="shrink-0" variant="outline">
                          {selectedAsset ? formatBytes(selectedAsset.size) : t.none}
                        </Badge>
                      </div>
                      <Separator />
                      <p className="truncate px-4 py-2 text-sm text-muted-foreground">
                        {release
                          ? `${release.tag_name} · ${formatDate(release.published_at, locale)}`
                          : t.releaseNotLoaded}
                      </p>
                    </div>

                    {release ? (
                      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
                        {firmwareAssets.map((asset) => {
                          const kind = firmwareKind(asset.name);
                          const selected = selectedAssetId === asset.id;
                          return (
                            <Tooltip key={asset.id}>
                              <TooltipTrigger asChild>
                                <button
                                  aria-pressed={selected}
                                  className={cn(
                                    "relative flex min-h-14 w-full min-w-0 items-center gap-3 overflow-hidden border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/45",
                                    selected && "bg-primary/[0.06]",
                                  )}
                                  onClick={() => setSelectedAssetId(asset.id)}
                                  type="button"
                                >
                                  {selected && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-primary" />}
                                  <Badge
                                    className={cn(
                                      "grid h-9 min-w-16 shrink-0 place-items-center rounded-md border px-3 text-sm",
                                      firmwareTone[kind],
                                    )}
                                    variant="secondary"
                                  >
                                    {firmwareLabel(asset, locale)}
                                  </Badge>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{asset.name}</span>
                                    <span className="mt-1 block text-sm text-muted-foreground">
                                      {formatBytes(asset.size)}
                                    </span>
                                  </span>
                                  {selected && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{asset.name}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ) : (
                      <Alert className="min-h-32 items-center bg-muted/25">
                        <RefreshCw className="size-4" />
                        <AlertDescription>{t.firmwareNotLoaded}</AlertDescription>
                      </Alert>
                    )}
                  </section>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_168px] gap-3 border-t bg-background pt-3">
                <section
                  aria-label={t.writeOptions}
                  className="grid min-w-0 grid-cols-3 divide-x overflow-hidden rounded-md border bg-muted/20"
                >
                  <OptionTile label={t.device} value={selectedDevice?.label ?? t.none} />
                  <OptionTile
                    label={t.status}
                    value={selectedDevice ? deviceStatusLabels[locale][selectedDevice.status] : t.notReady}
                  />
                  <OptionTile
                    label={t.firmwareSide}
                    value={selectedAsset ? firmwareLabel(selectedAsset, locale) : t.none}
                  />
                </section>
                <Button
                  className="h-full min-h-11 gap-2 rounded-md text-sm shadow-sm"
                  disabled={!readyToFlash}
                  onClick={() => void flashSelectedDevice()}
                >
                  {flashing ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />}
                  <span>{t.writeFirmware}</span>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;

function OptionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-sm font-medium">{value}</strong>
    </div>
  );
}
