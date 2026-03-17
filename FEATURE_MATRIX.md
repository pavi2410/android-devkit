# Android DevKit Feature Matrix

This matrix tracks Android DevKit features, user-facing UX surfaces, implementation status, and release maturity so the extension can evolve intentionally before v1.

## Status legend

- Planned
- In Progress
- Implemented
- Polishing

## Matrix

| Feature Area | Sub-feature | Primary UX Surface | Related Commands / Views / Settings | Status | Version | Notes |
|---|---|---|---|---|---|---|
| Devices | Connected device list | `Devices` tree view, welcome view | `androidDevkit.devices`, `androidDevkit.refreshDevices` | Implemented | 0.3.0 | Uses ADB-backed tree with inline/context actions. |
| Devices | Wireless connect over TCP/IP | Command palette, Devices view toolbar | `androidDevkit.connectDevice` | Implemented | 0.3.0 | Could later add richer validation and recent-target recall. |
| Devices | Wireless pairing | Command palette, Devices view toolbar | `androidDevkit.pairDevice` | Implemented | 0.3.0 | Good candidate for step-by-step UX polish. |
| Devices | ADB shell | Device context menu | `androidDevkit.openShell` | Implemented | 0.3.0 | Opens integrated terminal with device-targeted shell. |
| Devices | Screenshot capture | Device context menu | `androidDevkit.takeScreenshot` | Implemented | 0.3.0 | Already reveals/open screenshot after capture. |
| Devices | Reboot controls | Device context menu | `androidDevkit.rebootDevice` | Implemented | 0.3.0 | Includes normal / bootloader / recovery. |
| Devices | Run target selection | Status bar, Build & Run, command palette | `androidDevkit.selectRunTarget` | Polishing | 0.3.0 | Contextual status bar item added in current UX pass. |
| Logcat | Session lifecycle | Logcat view toolbar, status bar, command palette | `androidDevkit.startLogcat`, `androidDevkit.pauseLogcat`, `androidDevkit.stopLogcat`, `androidDevkit.clearLogcat`, `androidDevkit.logcatStatusMenu` | Polishing | Unreleased | Safe defaults now target `Info` and support Start / Pause / Stop / Clear. |
| Logcat | Output reveal | Status bar, Logcat toolbar | `androidDevkit.showLogcatOutput` | Implemented | Unreleased | Keeps output channel as the authoritative log surface. |
| Logcat | Package/PID targeting | Logcat controls, app-package detection | `androidDevkit.setLogcatPackageFilter` | Polishing | Unreleased | Defaults toward detected app package and PID when available, with prompt/picker fallback. |
| Logcat | Verbosity controls | Logcat controls | `androidDevkit.setLogcatFilter`, `androidDevkit.logcat.maxLines` | Polishing | Unreleased | Needs careful wording because verbose/debug can increase load. |
| Device Files | Browse files on selected device | Device context, `Device Files` view, welcome view | `androidDevkit.browseFiles`, `androidDevkit.fileExplorer` | Implemented | 0.3.0 | Welcome state now handles no-device-selected case. |
| Device Files | Pull file | File explorer context menu | `androidDevkit.pullFile` | Implemented | 0.3.0 | Uses save dialog and local file reveal flow. |
| Device Files | Push file | File explorer context menu | `androidDevkit.pushFile` | Implemented | 0.3.0 | Could later support drag/drop or multi-select. |
| Device Files | Delete remote file | File explorer context menu | `androidDevkit.deleteRemoteFile` | Implemented | 0.3.0 | Confirmation dialog already present. |
| Android Virtual Devices | AVD list | `Android Virtual Devices` view in `AVD Manager` container | `androidDevkit.avdManager` | Polishing | Unreleased | Container/view naming updated for clearer communication. |
| Android Virtual Devices | Create virtual device | View toolbar, welcome view, command palette | `androidDevkit.createAvd` | Implemented | 0.3.0 | Multi-step quick-pick flow. |
| Android Virtual Devices | Launch emulator | Context menu | `androidDevkit.launchAvd` | Implemented | 0.3.0 | Running-state detection can continue to be refined. |
| Android Virtual Devices | Delete / wipe data | Context menu | `androidDevkit.deleteAvd`, `androidDevkit.wipeAvdData` | Implemented | 0.3.0 | Danger actions already confirmed via modal prompts. |
| SDK | SDK setup discovery | Welcome view, notifications, command palette | `androidDevkit.showSdkInfo`, `androidDevkit.openSdkManager`, `androidDevkit.sdkPath` | Polishing | Unreleased | Welcome states now cover missing SDK path. |
| SDK | SDK Manager webview | Editor webview, command palette | `androidDevkit.openSdkManager` | Implemented | 0.3.0 | Editor-first workflow remains preferred. |
| Build & Run | Build variant selection | Status bar, Build & Run view | `androidDevkit.selectBuildVariant` | Polishing | Unreleased | Contextual status bar item added in current UX pass. |
| Build & Run | Build selected variant | Build & Run view, command palette | `androidDevkit.buildVariant` | Polishing | Unreleased | Success flow now offers APK folder / output actions. |
| Build & Run | Run on target device | Build & Run view, command palette | `androidDevkit.runOnDevice` | Polishing | Unreleased | Reuses resolved app package and offers actionable success flow. |
| Build & Run | Install APK from disk | Build & Run view, command palette | `androidDevkit.installApk` | Polishing | Unreleased | Success flow now offers APK reveal / output actions. |
| Build & Run | Stop app | Build & Run view, command palette | `androidDevkit.stopApp` | Implemented | 0.3.0 | Uses resolved app package against selected target device. |
| Gradle | Task browser | `Gradle Tasks` tree view | `androidDevkit.gradleTasks`, `androidDevkit.runGradleTask` | Implemented | 0.3.0 | Advanced/escape-hatch workflow. |
| Gradle | Sync / clean / assemble helpers | View toolbar, command palette | `androidDevkit.syncGradle`, `androidDevkit.cleanBuild`, `androidDevkit.assembleBuild` | Implemented | 0.3.0 | Could later align success feedback with Build & Run patterns. |
| Android Project | Project layout explorer | Explorer view | `androidDevkit.projectLayout`, `androidDevkit.refreshProjectLayout` | Implemented | 0.3.0 | Good candidate for more Android-specific context actions. |
| Onboarding | Walkthrough | VS Code walkthrough | `androidDevkit.getStarted` walkthrough | Implemented | 0.3.0 | Should stay aligned with renamed UX surfaces over time. |
| Command Surfaces | Command menu shortcut | Status-independent quick pick | `androidDevkit.commandMenu` | Implemented | 0.3.0 | Kept for now; remove later if native surfaces fully replace it. |
| Status Bar | Active target device | Left status bar | `androidDevkit.selectRunTarget` | Polishing | Unreleased | Visible workspace context item. |
| Status Bar | Active build variant | Left status bar | `androidDevkit.selectBuildVariant` | Polishing | Unreleased | Visible workspace context item. |
| Status Bar | Logcat controls | Left status bar | `androidDevkit.logcatStatusMenu` | Polishing | Unreleased | Visible only when devices/emulators are available. |
| Devices | Deep link testing | Command palette, device context menu | `androidDevkit.testDeepLink` | Implemented | 0.5.0 | Launch `am start -d <URI>` with URI input box. |
| Devices | Screen recording | Command palette, device context menu | `androidDevkit.recordScreen` | Implemented | 0.5.0 | Duration picker, `screenrecord` + pull + reveal. |
| Devices | App permission manager | Command palette, device context menu | `androidDevkit.grantPermission`, `androidDevkit.revokePermission` | Implemented | 0.5.0 | Grant/revoke runtime permissions via `pm`. |
| Devices | Scrcpy screen mirroring | Command palette, device context menu | `androidDevkit.mirrorScreen` | Implemented | 0.5.0 | Scrcpy-based mirroring with codec configuration. |
| Devices | Open Device File | Device file explorer context menu | `androidDevkit.openDeviceFile` | Implemented | 0.5.0 | Read files directly from device in editor tab. |
| Android Virtual Devices | Emulator launch mode | AVD context menu, settings | `androidDevkit.emulatorLaunchMode` | Implemented | 0.5.0 | Cold boot / quick boot selection. |
| Logcat | Crash log highlighter | Logcat output channel | — | Planned | — | Detect stack traces, linkify to source files. |

## Follow-up fields to maintain over time

- Keep `Status` and `Version` updated whenever a feature ships or changes materially.
- Add test coverage notes when automated validation is introduced for a feature area.
- Split rows further when a feature becomes large enough to have distinct UX modes or platforms.
