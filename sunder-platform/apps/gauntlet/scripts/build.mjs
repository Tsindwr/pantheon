import { access, cp, mkdir, rm } from "node:fs/promises";

const appRoot = new URL("../", import.meta.url);
const distRoot = new URL("dist/", appRoot);

const staticEntries = [
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "lib",
  "favicon.ico",
  "favicon.svg",
  "apple-touch-icon.png",
  "CNAME"
];

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });

for (const entry of staticEntries) {
  const source = new URL(entry, appRoot);
  if (!(await exists(source))) {
    continue;
  }

  await cp(source, new URL(entry, distRoot), {
    recursive: true,
    force: true
  });
}

console.log(`Gauntlet static site built at ${distRoot.pathname}.`);
