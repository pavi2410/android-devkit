# Changelog

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
