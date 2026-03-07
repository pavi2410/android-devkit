![Android DevKit Icon](apps/extension/icon-128.png)

# Android DevKit

A comprehensive, open-source VS Code extension that brings the Android Studio experience to VS Code — device management, Logcat, SDK Manager, AVD Manager, and more.

## Features

### Device Manager
- List connected devices and emulators via ADB with connection-type icons (USB, TCP/IP, wireless, emulator)
- Wireless debugging — pair via mDNS (Android 11+) or TCP/IP mode
- ADB shell in the integrated terminal
- Screenshots, reboot (normal / bootloader / recovery)

### Device File Explorer
- Browse the full file system of any connected device
- Upload, download, and delete files directly from the tree view

### Logcat Viewer
- Real-time log streaming in the VS Code panel
- Filter by level, tag/message text, or package name
- Color-coded via VS Code's native `LogOutputChannel`

### SDK Manager
- Android Studio-style SDK Manager webview with two tabs: **SDK Platforms** and **SDK Tools**
- Packages grouped by API level (platforms) and tool family (build-tools, NDK, CMake, etc.)
- Checkbox-based batch install/uninstall with an **Apply** button
- "Show Package Details" toggle to expand groups into individual packages
- "Hide Obsolete Packages" toggle (on by default)
- Update availability detection with version display
- Output streamed to a dedicated output channel

### AVD Manager
- List Android Virtual Devices with live running-state detection (polls `adb devices`)
- Create AVDs via a 3-step quick-pick wizard (system image → device profile → name)
- Launch, delete, and wipe AVDs
- AVD config enrichment (display name, RAM, LCD, CPU, GPU, Play Store status)

### Gradle Tasks
- Tree view listing all Gradle tasks with inline run buttons
- Sync, build, and clean actions in the view title bar

### Build & Run
- Build variants auto-detected from `assemble*` tasks
- Run on device with device picker; Build / Run / Stop buttons
- Install APK from file picker
- App package auto-detection from `AndroidManifest.xml`

### Android Project Layout
- Tree view showing module structure, source sets, and resource navigation

### Command Menu & UX
- Status bar button (`Android DevKit`) opens a quick-pick menu for fast access to all views and actions
- `Add Android SDK Tools to Terminal PATH` command auto-prepends `platform-tools`, `emulator`, `cmdline-tools` to new terminal sessions
- Native VS Code walkthrough shown on first activation with guided onboarding steps

## Installation

### From VS Code Marketplace

Search for **Android DevKit** in the Extensions panel.

### From Source

```bash
git clone https://github.com/pavi2410/android-devkit.git
cd android-devkit

bun install

# Build all packages + webview + extension
mise run build

# Package the VSIX
mise run package
```

> Requires [mise](https://mise.jdx.dev/) and [Bun](https://bun.sh/).

Then install the generated `.vsix` from `apps/extension/build/`.

### Prerequisites
- Android SDK (auto-detected from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or Android Studio install paths)
- `adb` accessible (bundled in `platform-tools`)

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `androidDevkit.sdkPath` | Override the auto-detected Android SDK root | Auto-detect |
| `androidDevkit.logcat.defaultLogLevel` | Default minimum Logcat level for new sessions | `I` |
| `androidDevkit.logcat.maxLines` | Max logcat entries kept in memory before older entries are discarded | `10000` |

## Project Structure

```
android-devkit/
├── mise.toml                        # Task runner (build, dev, package, test)
├── packages/
│   ├── adb/                         # @android-devkit/adb  — ADB wrapper
│   ├── sdk/                         # @android-devkit/sdk  — sdkmanager wrapper
│   └── avd/                         # @android-devkit/avd  — avdmanager + emulator wrapper
├── apps/
│   ├── extension/                   # VS Code extension
│   │   └── src/
│   │       ├── extension.ts         # Entry point
│   │       ├── commands/            # Command handlers (devices, sdk, avd, gradle, run, command-menu)
│   │       ├── views/               # TreeView providers (devices, logcat, files, avd, gradle, build-run, project-layout)
│   │       ├── services/            # AdbService, SdkService, GradleService, terminal-env
│   │       └── webviews/            # Webview panel hosts (SDK Manager)
│   └── webview-sdk-manager/         # SDK Manager webview (Vite + React + Tailwind)
├── package.json                     # Bun workspaces config
└── tsconfig.base.json               # Shared TypeScript config
```

## Goals

1. **Device & Emulator Management** — List devices, launch emulators, ADB shell
2. **Logcat Viewer** — Real-time streaming with filtering and color coding
3. **SDK Manager** — Android Studio-style SDK management with batch operations
4. **AVD Manager** — Create and manage Android Virtual Devices
5. **Build & Run** — Gradle tasks, build variants, run on device, install APK
6. **Code Intelligence** — Kotlin LSP integration *(upcoming)*
7. **Debugging** — Android debug adapter with breakpoints *(upcoming)*

## Non-Goals

1. **Replace Android Studio entirely** — Compose Preview, Layout Editor depend on JetBrains infrastructure
2. **New Kotlin language server** — leverage the official Kotlin LSP
3. **Flutter / React Native** — native Kotlin/Java Android only
4. **NDK/C++ support** — out of scope
5. **iOS development** — Android only

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
