# Roadmap

## Milestone 1: Alpha (MVP) ✅
- [x] Device Manager with basic actions (USB, TCP/IP, wireless)
- [x] Logcat viewer with filtering (level, tag, package)
- [x] Device File Explorer (browse, upload, download, delete)
- [x] ADB shell in integrated terminal
- [x] Android SDK auto-detection

## Milestone 2: SDK & Emulator Management ✅
- [x] Welcome & setup page (Webview, Vite + React + Tailwind)
- [x] SDK Manager — list, install, uninstall, update packages via `sdkmanager`
- [x] AVD Manager — create, launch, delete, wipe Android Virtual Devices via `avdmanager`

## Milestone 3: Build & Run ✅
- [x] Gradle task runner (sync, build, clean) — via `vscjava.vscode-gradle` API + `./gradlew` fallback
- [x] Build variants support — auto-detected from `assemble*` tasks
- [x] Run configurations (install APK & launch app) — Build / Run / Stop buttons with device picker
- [x] APK installation from file picker
- [x] App package auto-detection from `AndroidManifest.xml`

### QoL Backlog (Milestone 3+)
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
