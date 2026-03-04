# Changelog

## [0.2.0] - 2026-03-04

### Added
- Welcome & Setup page: auto-shown on first activation when SDK is not detected; guided SDK path picker; quick links to all major views
- SDK Manager: list installed and available SDK packages grouped by category (Platforms, Build Tools, Platform Tools, System Images, Extras) via `sdkmanager`
- SDK Manager: install, uninstall, and update-all packages with live output streamed to a dedicated output channel
- AVD Manager: list Android Virtual Devices with live running-state detection (polls `adb devices` every 5s)
- AVD Manager: 3-step create wizard (system image → hardware profile → name)
- AVD Manager: launch, delete, and wipe-data for AVDs
- New `@android-devkit/sdk` package — standalone `sdkmanager` wrapper
- New `@android-devkit/avd` package — standalone `avdmanager` + `emulator` wrapper
- New `apps/webview-welcome` app — Vite + React 18 + Tailwind v4 welcome page using VS Code CSS variables for theme compatibility
- `mise.toml` project-root task runner for orchestrating builds across packages (`mise run build`, `mise run dev`, `mise run package`)

### Changed
- SDK path detection logic moved to new `SdkService`; `AdbService` now delegates to it
- Status bar "SDK not found" tooltip now links to the Welcome page

## [0.1.0] - 2026-02-28

### Added
- Device Manager: list connected devices and emulators with connection type classification (USB, TCP/IP, Wireless, Emulator)
- Device Manager: wireless debugging support — pair via mDNS and connect via TCP/IP
- Device Manager: open ADB shell in integrated VS Code terminal
- Device Manager: browse device file system with pull, push, and delete operations
- Logcat Viewer: stream logcat with filtering by log level and text
- Logcat Viewer: filter by package name (resolved via PID)
- Logcat Viewer: colorized output via VS Code LogOutputChannel severity levels
- Settings: Android SDK auto-detection from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and platform-specific default paths
- Status bar item showing detected Android SDK path
