# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Android DevKit is a VS Code extension that provides Android development tools (ADB, SDK Manager, AVD Manager, Logcat, Gradle, Scrcpy) directly in the editor. It's a pnpm monorepo with TypeScript packages and React webviews.

## Commands

```bash
# Install dependencies
pnpm install

# Build everything
pnpm build

# Build only packages (run before building apps)
pnpm build:packages

# Build only the extension and webviews
pnpm build:apps

# Watch for changes (extension only)
pnpm dev

# Run all tests
pnpm test

# Type check all packages
pnpm typecheck

# Lint
pnpm lint

# Package extension as .vsix
pnpm package

# Clean all dist directories
pnpm clean
```

Run tests for a single package: `pnpm --filter <package-name> run test`

## Architecture

### Monorepo Structure

- `packages/` — Reusable Android tool wrappers (each published as `@android-devkit/*`)
  - `tool-core` — Base command execution primitives
  - `android-sdk` — SDK discovery and path resolution
  - `adb` — ADB wrapper built on `@yume-chan/adb`
  - `sdkmanager`, `avdmanager`, `emulator`, `logcat`, `gradle`, `android-project`
- `apps/extension/` — The VS Code extension (main app)
- `apps/webview-sdk-manager/` — SDK Manager UI (React + Tailwind + Vite, embedded as webview)
- `apps/webview-scrcpy/` — Screen mirroring UI (webview)

### Extension Internals (`apps/extension/src/`)

The extension follows a **feature-based registration** pattern:

1. `extension.ts` activates, creates a `ServiceContainer`, and registers each feature
2. Each feature module (`features/`) registers commands, creates TreeView providers, and subscribes to services
3. Services (`services/`) wrap the `@android-devkit/*` packages and expose VS Code-friendly APIs
4. Webview panels (`webviews/`) host the separately-built React apps

**ServiceContainer** is the central dependency container: `AdbService`, `SdkService`, `LogcatService`, `ScrcpyService`, `GradleService`.

### Webviews as Separate Apps

`apps/webview-sdk-manager/` is a full Vite+React app. It's built to `dist/webview-sdk-manager/` and embedded in the extension via a webview panel. Communication uses `postMessage` / VS Code's webview messaging API.

### Build Pipeline

- Packages: TypeScript compiled with `tsc`
- Extension: Bundled with **Rolldown** (outputs CommonJS for VS Code)
- Webviews: Bundled with **Vite** (outputs ES modules for webview sandbox)
- Build order matters: packages must be built before apps

### Key Technologies

- TypeScript 6, strict mode, ES2022 target
- `@yume-chan/adb` — ADB protocol over TCP (not shell exec)
- React 19 + Tailwind CSS 4 (webviews)
- Vitest (tests), Oxlint (linting)
- pnpm workspace catalog (`pnpm-workspace.yaml`) centralizes all dependency versions

### Dependency Versions

All shared dependency versions are defined in `pnpm-workspace.yaml` under `catalog:`. When adding dependencies, prefer using catalog versions rather than pinning inline.
