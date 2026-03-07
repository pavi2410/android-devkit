# Android DevKit

![Android DevKit](icon-128.png)

A comprehensive VS Code extension that brings core Android development tools directly into your editor — device management, real-time Logcat, SDK Manager, AVD Manager, device file explorer, and automatic Android SDK detection.

## Features

### Welcome & Setup

- Auto-shown on first activation when the Android SDK is not detected
- Guided SDK path picker with detection status
- Quick links to open SDK Manager, AVD Manager, and Device Manager
- Open any time via **Android DevKit: Welcome / Setup**

### Device Manager

- **Connection type awareness** — classifies each device as Emulator, USB, TCP/IP, or Wireless with a matching icon
- **Wireless debugging** — pair devices via mDNS (Android 11+) and switch USB devices to TCP/IP mode
- **ADB shell** — open an interactive shell for any device in the integrated terminal
- **Screenshots** — capture and save a screenshot from the active device
- **Reboot** — reboot to normal, bootloader, or recovery

### Device File Explorer

- Browse the full file system of any connected device
- **Download** files from the device to your local machine
- **Upload** local files to any directory on the device
- **Delete** files and directories directly from the tree view

### Logcat Viewer

- Real-time log streaming in the VS Code panel area
- Filter by **log level** (Verbose → Fatal)
- Filter by **text** (tag or message content)
- Filter by **package name** — logs are automatically scoped to that app's PID
- Color-coded severity via VS Code's native `LogOutputChannel`
- Clear logs, start/stop streaming on demand

### SDK Manager

- Lists all installed and available SDK packages grouped by category (Platforms, Build Tools, Platform Tools, System Images, Extras)
- **Install** packages inline from the tree view
- **Uninstall** installed packages via context menu
- **Update all** installed packages in one click
- Output streamed live to a dedicated output channel

### AVD Manager

- Lists all Android Virtual Devices with live **running state** — polls `adb devices` every 5 seconds to detect active emulator sessions
- **Create AVD wizard** — 3-step quick-pick flow: system image → hardware profile → name
- **Launch** AVDs directly from the tree view (fire-and-forget, detached)
- **Delete** and **wipe user data** via context menu

### Android SDK Auto-Detection

- Resolves SDK path from `ANDROID_HOME` → `ANDROID_SDK_ROOT` → platform default paths (Android Studio install locations on macOS, Windows, Linux)
- Status bar item shows the detected SDK path at a glance
- Override via the `androidDevkit.sdkPath` setting

## Requirements

- Android SDK (auto-detected, or configure `androidDevkit.sdkPath`)
- `adb` accessible — bundled in `platform-tools`
- A connected Android device or running emulator

## Usage

1. Open a folder containing an Android project (`build.gradle`, `settings.gradle`, or `AndroidManifest.xml`)
2. The extension activates automatically — the Welcome page opens on first run if SDK is not found
3. Click the **Android DevKit** icon in the Activity Bar to manage devices and browse files
4. Click the **Android SDK** icon in the Activity Bar to open SDK Manager and AVD Manager
5. Open the **Logcat** panel (next to Terminal) to stream logs

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `androidDevkit.sdkPath` | Override the auto-detected Android SDK root | Auto-detect |
| `androidDevkit.logcat.defaultLogLevel` | Default minimum Logcat level for new sessions | `I` |
| `androidDevkit.logcat.maxLines` | Maximum logcat entries kept in memory before older entries are discarded | `10000` |

## Commands

All commands are available via the Command Palette (`Cmd+Shift+P`) under the **Android DevKit** category:

| Command | Description |
|---------|-------------|
| Welcome / Setup | Open the welcome and setup page |
| Refresh Devices | Re-scan for connected devices |
| Connect Device (TCP/IP) | Connect to a device by IP address |
| Pair Device (Wireless Debugging) | Pair a new device using the mDNS pairing code |
| Enable TCP/IP Mode | Switch a USB device to TCP/IP mode on port 5555 |
| Open ADB Shell | Open an interactive shell in the terminal |
| Browse Device Files | Open the Device Files explorer for a device |
| Take Screenshot | Capture a screenshot from the selected device |
| Reboot Device | Reboot the selected device |
| Start / Stop Logcat | Control log streaming |
| Set Logcat Filter | Filter by tag or message text |
| Filter Logcat by Package | Scope logs to a specific app package |
| Clear Logcat | Clear the log output |
| Refresh SDK Packages | Reload the SDK Manager package list |
| Install SDK Package | Install a package by ID or from the tree view |
| Uninstall SDK Package | Remove an installed SDK package |
| Update All SDK Packages | Update all installed packages via `sdkmanager --update` |
| Refresh AVDs | Reload the AVD list |
| Create Virtual Device | Launch the 3-step AVD creation wizard |
| Launch Emulator | Start an AVD in the emulator |
| Delete Virtual Device | Permanently remove an AVD |
| Wipe AVD Data | Wipe user data for an AVD |
| Show Android SDK Info | Display the detected SDK path |

## Links

- [GitHub Repository](https://github.com/pavi2410/android-devkit)
- [Report an Issue](https://github.com/pavi2410/android-devkit/issues)
- [Roadmap](https://github.com/pavi2410/android-devkit/blob/main/ROADMAP.md)
- [Changelog](https://github.com/pavi2410/android-devkit/blob/main/CHANGELOG.md)

## License

MIT
