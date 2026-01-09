# Android DevKit

A comprehensive, open-source VS Code extension that brings the Android Studio experience to VS Code, enabling productive Android app development without the resource overhead of Android Studio.

## Features

### Device Manager
- List connected devices and emulators via ADB
- Show device details (model, Android version, API level)
- Connect to devices over wireless ADB
- Take screenshots
- Reboot devices (normal, bootloader, recovery)

### Logcat Viewer
- Real-time log streaming in the panel area
- Filter by log level (Verbose, Debug, Info, Warning, Error, Fatal)
- Filter by tag or message content
- Color-coded output in the Output Channel
- Clear logs, pause/resume streaming

## Installation

### From Source
```bash
# Clone the repository
git clone https://github.com/pavi2410/android-devkit.git
cd android-devkit

# Install dependencies
bun install

# Build
bun run build

# Package the extension
cd packages/extension
bun run package
```

Then install the generated `.vsix` file in VS Code.

### Prerequisites
- Android SDK with `adb` in PATH (or configure `androidDevkit.adbPath`)
- Node.js 18+ (for development)

## Usage

1. Open a folder containing an Android project (with `build.gradle` or `AndroidManifest.xml`)
2. The extension activates automatically
3. Click the Android DevKit icon in the Activity Bar to see connected devices
4. Open the Logcat panel (next to Terminal) to view logs

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `androidDevkit.adbPath` | Path to ADB executable | Auto-detect |
| `androidDevkit.sdkPath` | Path to Android SDK | Auto-detect |
| `androidDevkit.logcat.defaultFilter` | Default logcat filter | (empty) |
| `androidDevkit.logcat.maxLines` | Max logcat lines in memory | 10000 |

---

## Goals

1. **Device & Emulator Management** - List devices, launch emulators, view device info
2. **Logcat Viewer** - Real-time log streaming with filtering, search, and color coding
3. **Build & Run** - Gradle sync, build, install, and run with build variant selection
4. **SDK Manager** - Install/update SDK platforms, build-tools, and system images
5. **Code Intelligence** - Leverage Kotlin LSP for navigation, completion, and refactoring
6. **Debugging** - Native Android debugging with breakpoints, watch, and evaluate

## Non-Goals

1. **Replace IntelliJ/Android Studio entirely** - Some advanced features (Compose Preview, Layout Editor) depend heavily on JetBrains infrastructure
2. **Build a new Kotlin language server** - Leverage JetBrains' official Kotlin LSP instead
3. **Support Flutter/React Native** - Focus on native Kotlin/Java Android development
4. **NDK/C++ support** - Keep scope manageable; native code devs likely need Android Studio
5. **iOS development** - Android only

## Roadmap

### Milestone 1: Alpha (MVP) - Current
- [x] Device Manager with basic actions
- [x] Logcat viewer with filtering
- [ ] Basic Gradle task runner

### Milestone 2: Beta
- [ ] Build variants support
- [ ] Run configurations (install & launch)
- [ ] Emulator management (list, launch, stop AVDs)
- [ ] SDK Manager

### Milestone 3: v1.0
- [ ] Stable Kotlin LSP integration
- [ ] Polished UI/UX
- [ ] Comprehensive documentation

### Milestone 4: Debugging
- [ ] Android debug adapter
- [ ] Breakpoints, watch, evaluate

### Milestone 5: Beyond
- [ ] Layout Inspector
- [ ] APK Analyzer
- [ ] Profiler integration

## Project Structure

```
android-devkit/
├── packages/
│   ├── adb/                  # @android-devkit/adb - ADB wrapper library
│   │   └── src/
│   │       ├── client.ts     # ADB command execution
│   │       ├── devices.ts    # Device management
│   │       ├── logcat.ts     # Log streaming
│   │       └── types.ts      # Type definitions
│   │
│   └── extension/            # VS Code extension
│       └── src/
│           ├── extension.ts  # Entry point
│           ├── commands/     # Command handlers
│           ├── views/        # TreeView providers
│           └── services/     # Business logic
│
├── package.json              # Bun workspaces config
└── tsconfig.base.json        # Shared TypeScript config
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
