import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(join(root, "web", "index.html"), join(dist, "index.html"));
await cp(join(root, "web"), join(dist, "web"), { recursive: true });
await mkdir(join(dist, "app"), { recursive: true });
await cp(join(root, "app", "globals.css"), join(dist, "app", "globals.css"));
await cp(join(root, "public"), join(dist, "public"), { recursive: true });

console.log("Vercel static output prepared in dist/");
