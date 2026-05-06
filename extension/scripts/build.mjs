import { cp, mkdir, copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
await copyFile(resolve(root, "popup.html"), resolve(dist, "popup.html"));
await copyFile(resolve(root, "src/background.js"), resolve(dist, "background.js"));
await copyFile(resolve(root, "src/popup.js"), resolve(dist, "popup.js"));
await cp(resolve(root, "src/background"), resolve(dist, "background"), { recursive: true });
await cp(resolve(root, "src/content"), resolve(dist, "content"), { recursive: true });
await cp(resolve(root, "src/popup"), resolve(dist, "popup"), { recursive: true });
await cp(resolve(root, "src/i18n"), resolve(dist, "i18n"), { recursive: true });
await cp(resolve(root, "src/util"), resolve(dist, "util"), { recursive: true });
await cp(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });

console.log("Built extension/dist");
