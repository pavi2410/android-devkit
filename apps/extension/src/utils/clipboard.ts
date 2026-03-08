import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function copyImageToClipboard(imagePath: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    await execAsync(
      `osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as «class PNGf»)'`
    );
  } else if (platform === "linux") {
    await execAsync(`xclip -selection clipboard -t image/png -i "${imagePath}"`);
  } else if (platform === "win32") {
    await execAsync(
      `powershell -command "Set-Clipboard -Path '${imagePath}'"`
    );
  } else {
    throw new Error(`Clipboard copy not supported on ${platform}`);
  }
}
