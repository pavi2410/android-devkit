import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/extension.ts",
  external: ["vscode"],
  platform: "node",
  output: {
    file: "dist/extension.js",
    format: "cjs",
    codeSplitting: false,
  },
});
