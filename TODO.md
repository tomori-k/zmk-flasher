# TODO

- Cross-platform device detection and flashing support
  - Windows: detect UF2 drives, USB VID/PID changes, and serial ports without relying on macOS `ioreg`.
  - Linux: detect mount points and USB devices under `/run/media`, `/media`, `/dev`, and sysfs.
  - Keep the UI behavior consistent: non-bootloader devices are visible but cannot be flashed; bootloader devices are writable.
