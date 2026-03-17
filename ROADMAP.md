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
- [x] Extension test suite (83 tests) with vitest + full VS Code API mock
- [x] Disposal/cleanup fixes across all providers and services

### QoL Backlog (completed)
- [x] Last-used device memory (persist selected device serial via `ExtensionContext.globalState`)
- [x] Uninstall app — wire up existing `uninstallPackage` ADB primitive as a command
- [x] Logcat export to file — save current buffer (with active filters) to a timestamped `.log`
- [x] Screenshot → clipboard — offer "Copy to Clipboard" after `takeScreenshot`
- [x] App data wiper — `adb shell pm clear <package>` as a right-click action

## Milestone 4: Quick Wins (v0.5.0)

**Priority features:**
- [x] Deep link testing — launch `adb shell am start -d <URI>` with input box
- [x] Screen recording — `adb shell screenrecord` with duration picker, save & open
- [x] App permission manager — grant/revoke runtime permissions via context menu
- [ ] Crash log highlighter — detect stack traces, linkify to source files

**Device & ADB:**
- [ ] Device properties panel — expose `getDeviceProps` output in a read-only detail view
- [ ] App component browser — list activities, services, receivers, providers from `dumpsys`
- [ ] Wireless ADB auto-discovery — passive mDNS scan, show discoverable devices in welcome view
- [x] scrcpy integration — launch device mirroring with codec configuration and video streaming
- [x] Open Device File — read files directly from device in a VS Code editor tab
- [x] Device transport eviction — automatically evict stale ADB transports

**Infrastructure:**
- [x] Migrated ADB layer to Tango ADB library (`@yume-chan/adb`)
- [x] Upgraded build tooling to Vite 8 + Rolldown
- [x] Centralized dependency versions via Bun catalog
- [x] Emulator launch mode setting (cold boot / quick boot)

**Build & Gradle:**
- [ ] Gradle task search/filter in tree view
- [ ] Gradle build cache stats & clean action
- [ ] Build time profiler — parse `--profile` output, show slow tasks
- [ ] Signing config helper — generate/manage debug & release keystores

**Logcat:**
- [ ] Logcat one-shot snapshot — dump buffered logcat to a new editor tab
- [ ] Logcat regex filter — support regex in text filter field

**Emulator:**
- [ ] GPS location simulation — set lat/long on running emulator via `geo fix`
- [ ] Network condition simulation — throttle speed/latency via emulator console
- [ ] Emulator snapshots — list, load, save snapshots

**Project:**
- [ ] Resource string translation helper — show missing translations across `values-*/strings.xml`
- [ ] APK size breakdown — parse APK with `aapt2` and show size by component

## Milestone 5: v1.0
- [ ] Kotlin language support — recommend/activate `fwcd.kotlin` extension
- [ ] Java language support — recommend/activate `redhat.java` extension
- [ ] XML language support — recommend/activate `redhat.vscode-xml` with Android schema
- [ ] Android-specific code actions (e.g., extract string resource)
- [ ] Multi-module Build & Run — module-aware variant detection and APK discovery
- [ ] Polished UI/UX across all views
- [ ] Comprehensive documentation & changelog
- [ ] ADB package test coverage
- [ ] Emulator package test coverage
- [ ] CI hardening — fix pre-existing test failures in tool-core, sdkmanager, avdmanager

## Milestone 6: Debugging
- [ ] Android debug adapter
- [ ] Breakpoints, watch variables, evaluate expressions
- [ ] Logcat integration with debug session — auto-start logcat when debugging
- [ ] Native crash symbolication

## Milestone 7: Beyond
- [ ] Layout Inspector — dump view hierarchy via `uiautomator dump`
- [ ] APK Analyzer — parse APK contents, DEX stats, resource table
- [ ] Profiler integration — CPU/memory sampling via `simpleperf`/`am profile`
- [x] Device screen mirroring (scrcpy-based) — moved to Milestone 4
- [ ] Compose Preview (if Kotlin LSP supports it)
