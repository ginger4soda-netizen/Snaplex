import { spawnSync } from "node:child_process";
import { cp, mkdir, copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const skipTestFiles = (source) => !/\.test\.(js|ts|mjs)$/.test(source);

const iconBuild = spawnSync(
  process.execPath,
  [resolve(root, "../scripts/build-extension-icons.mjs")],
  { stdio: "inherit" }
);
if (iconBuild.status !== 0) {
  process.exit(iconBuild.status ?? 1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
await copyFile(resolve(root, "popup.html"), resolve(dist, "popup.html"));
await copyFile(resolve(root, "src/background.js"), resolve(dist, "background.js"));
await copyFile(resolve(root, "src/popup.js"), resolve(dist, "popup.js"));
await cp(resolve(root, "src/background"), resolve(dist, "background"), { recursive: true, filter: skipTestFiles });
await cp(resolve(root, "src/popup"), resolve(dist, "popup"), { recursive: true, filter: skipTestFiles });
await cp(resolve(root, "src/i18n"), resolve(dist, "i18n"), { recursive: true, filter: skipTestFiles });
await cp(resolve(root, "src/util"), resolve(dist, "util"), { recursive: true, filter: skipTestFiles });
await cp(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });
await cp(resolve(root, "src/content/floating-ball/core.css"), resolve(dist, "content/floating-ball/core.css"));
await cp(resolve(root, "src/content/batch/runner.css"), resolve(dist, "content/batch/runner.css"));
await cp(resolve(root, "src/content/region-overlay"), resolve(dist, "content/region-overlay"), { recursive: true, filter: skipTestFiles });
await copyFile(resolve(root, "src/content/video-capture-injected.js"), resolve(dist, "content/video-capture-injected.js"));

const contentEntries = [
  { in: "src/content/xiaohongshu/floating-ball.js", out: "content/xiaohongshu/floating-ball.js" },
  { in: "src/content/generic/floating-ball.js", out: "content/generic/floating-ball.js" },
  { in: "src/content/batch/index.js", out: "content/batch/index.js" }
];

await esbuild({
  entryPoints: contentEntries.map((entry) => ({
    in: resolve(root, entry.in),
    out: entry.out.replace(/\.js$/, "")
  })),
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  outdir: dist,
  legalComments: "none"
});

console.log("Built extension/dist");
