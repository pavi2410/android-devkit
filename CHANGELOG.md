# Changelog

## [0.3.0] - 2026-03-06

### Added
- **Gradle Task Runner** — sync, build, clean via `./gradlew`; new `GradleService`, `GradleTasksProvider` tree view with inline run buttons
- **Build & Run** — build variants auto-detected from `assemble*` tasks; run on device with device picker; stop app; install APK from file picker; app package auto-detection from `AndroidManifest.xml`
- **Android Project Layout** — tree view showing module structure, source sets, and resource navigation (`ProjectLayoutProvider`)
- **Command Menu** — status bar quick-pick menu (`$(device-mobile) Android DevKit`) for fast access to all major views and actions
- **Terminal PATH injection** — `Add Android SDK Tools to Terminal PATH` command; auto-prepends `platform-tools`, `emulator`, `cmdline-tools/latest/bin` to new terminal sessions
- **SDK Manager webview** — Android Studio-style layout with two tabs (SDK Platforms / SDK Tools), checkbox-based batch install/uninstall with Apply button, "Show Package Details" and "Hide Obsolete Packages" toggles, collapsible groups, update availability display
- **Getting Started walkthrough** — native VS Code walkthrough with 5 guided steps (Configure SDK, Explore Devices, Open SDK Manager, Create AVD, View Logcat); shown on first activation
- **SDK parser enrichment** — `installedVersion`, `availableVersion`, `obsolete` fields on `SdkPackage`; parses "Available Updates" and "Available Obsolete Packages" sections from `sdkmanager --list`
- **AVD config parsing** — new `parseAvdConfig()`, `readAvdConfig()` functions and `AvdConfig` type; AVDs enriched with config.ini data (display name, RAM, LCD, CPU, GPU, Play Store, etc.)
- **AVD parser improvements** — better API level extraction with multiple fallback patterns; inline `Tag/ABI:` parsing from `Based on:` line; `sdcard` field on `Avd` type
- **ADB service** — `installApk()`, `launchApp()`, `forceStopApp()` methods
- **Logcat** — view icon added to sidebar panel
- **Test suites** — `parseSdkManagerList` (11 tests), `parseAvdList` (9 tests), `parseAvdConfig` (11 tests), `parseDeviceProfiles` (8 tests) with fixture files

### Changed
- SDK Manager tree view replaced with webview panel; tree provider retained for category-sorted fallback
- SDK Manager packages sorted descending by API level / version
- Welcome webview replaced by native VS Code walkthrough
- Status bar changed from SDK path indicator to Command Menu button
- Output channel names prefixed with `ADK:` (e.g. `ADK: Logcat`, `ADK: SDK Manager`)
- Gradle switched to terminal task runner with rich console output
- `NoSdkItem` commands in SDK Manager and AVD Manager tree views link to `showSdkInfo` instead of removed Welcome page
- `registerSdkCommands` no longer depends on `SdkManagerProvider`
- Device profile parser OEM field extraction uses regex for flexible whitespace

### Removed
- `apps/extension-pack/` — VS Code extension pack (in favor of standalone extension)
- `apps/webview-welcome/` — custom Welcome webview (replaced by walkthrough)
- `androidDevkit.openWelcome` command
- `androidDevkit.sdkManager` tree view from sidebar (replaced by webview panel)
- SDK Manager context menu items (`installSdkPackage`, `uninstallSdkPackage` inline/context actions)

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
