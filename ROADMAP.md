# Roadmap

## Milestone 1: Alpha (MVP) ✅
- [x] Device Manager with basic actions (USB, TCP/IP, wireless)
- [x] Logcat viewer with filtering (level, tag, package)
- [x] Device File Explorer (browse, upload, download, delete)
- [x] ADB shell in integrated terminal
- [x] Android SDK auto-detection

## Milestone 2: SDK & Emulator Management ✅
- [x] SDK Manager — list, install, uninstall, update packages via `sdkmanager`
- [x] AVD Manager — create, launch, delete, wipe Android Virtual Devices via `avdmanager`

## Milestone 3: Build & Run, SDK Manager Redesign, UX ✅
- [x] Gradle task runner (sync, build, clean) via `./gradlew` with `GradleTasksProvider` tree view
- [x] Build variants — auto-detected from `assemble*` tasks
- [x] Run on device — Build / Run / Stop with device picker; APK install from file picker
- [x] App package auto-detection from `AndroidManifest.xml`
- [x] SDK Manager rewritten as Android Studio-style webview (SDK Platforms / SDK Tools tabs)
- [x] Checkbox-based batch install/uninstall with Apply button
- [x] "Show Package Details" / "Hide Obsolete Packages" toggles
- [x] Platform groups by API level with Android version name lookup (API 7–36.1)
- [x] Tool groups by family (Build-Tools, NDK, CMake, etc.) with singleton detection
- [x] Update availability + obsolete package detection from `sdkmanager --list`
- [x] Android Project Layout tree view (module, source, resource navigation)
- [x] Command Menu — status bar quick-pick for fast access to all views
- [x] Terminal PATH injection — auto-prepend Android SDK tool dirs to new terminals
- [x] Native VS Code walkthrough replacing custom Welcome webview
- [x] AVD config parsing (`parseAvdConfig`, `readAvdConfig`, `AvdConfig` type)
- [x] Test suites for SDK parser, AVD list, AVD config, device profiles (39 tests total)
- [x] Extension pack removed in favor of standalone extension

### QoL Backlog
- [ ] Last-used device memory (persist selected device serial via `ExtensionContext.globalState`)
- [ ] Gradle task search/filter in tree view
- [ ] Additional `extensionDependencies` — `redhat.java`, `fwcd.kotlin`, `redhat.vscode-xml` (Milestone 4)
- [ ] Uninstall app — wire up existing `uninstallPackage` ADB primitive as a command
- [ ] Logcat export to file — save current buffer (with active filters) to a timestamped `.log`
- [ ] Screenshot → clipboard — offer "Copy to Clipboard" after `takeScreenshot`
- [ ] `getLogcat` one-shot snapshot — dump captured logcat to a new editor buffer
- [ ] Multi-module Build & Run — pick assemble task from any module, not just root `app`
- [ ] App data wiper — `adb shell pm clear <package>` as a right-click action
- [ ] Device properties panel — expose `getDeviceProps` output in a read-only detail view

## Milestone 4: v1.0
- [ ] Stable Kotlin LSP integration
- [ ] Polished UI/UX across all views
- [ ] Comprehensive documentation & changelog

## Milestone 5: Debugging
- [ ] Android debug adapter
- [ ] Breakpoints, watch variables, evaluate expressions

## Milestone 6: Beyond
- [ ] Layout Inspector
- [ ] APK Analyzer
- [ ] Profiler integration
