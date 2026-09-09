import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const dist = "dist";
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  format: "iife",
  minify: false,
  sourcemap: "inline",
  target: "chrome110",
};

await build({ ...common, entryPoints: ["src/background.ts"], outfile: `${dist}/background.js` });
await build({ ...common, entryPoints: ["src/popup/index.ts"], outfile: `${dist}/popup.js` });
await build({ ...common, entryPoints: ["src/options/index.ts"], outfile: `${dist}/options.js` });

cpSync("manifest.json", `${dist}/manifest.json`);
cpSync("src/popup/index.html", `${dist}/popup.html`);
cpSync("src/options/index.html", `${dist}/options.html`);
if (existsSync("images")) cpSync("images", `${dist}/images`, { recursive: true });

console.log("build done -> chrome-extension/dist");