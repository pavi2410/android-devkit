# Scrcpy Server Binary

The file `scrcpy-server-v3.3.1` is the scrcpy server JAR pushed to Android devices for screen mirroring.

To update the server version:
1. Download from official scrcpy releases: https://github.com/Genymobile/scrcpy/releases
2. Rename to `scrcpy-server-v<VERSION>`
3. Update `SCRCPY_SERVER_VERSION` in `src/services/scrcpy.ts`

See https://tangoadb.dev/scrcpy/prepare-server/#download-from-official-releases for version compatibility details.
