import { build } from "esbuild";
import { stat } from "node:fs/promises";

const entry = "node_modules/@neondatabase/neon-js/dist/index.mjs";
const output = "neon-sdk.bundle.js";

try {
  await stat(entry);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    outfile: output,
    minify: true,
    sourcemap: false,
    legalComments: "none",
    logLevel: "info"
  });
  console.log("Built the local Neon browser SDK:", output);
} catch (error) {
  console.error("Could not build the local Neon browser SDK:", error?.message || error);
  process.exitCode = 1;
}