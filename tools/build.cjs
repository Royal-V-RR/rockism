// Rockism build. The app ships as a single self-contained index.html plus
// the one file that genuinely cannot be inlined (the service worker, which
// browsers require to be registered from an external script URL). This
// script just assembles a clean dist/ directory for GitHub Pages.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const INCLUDE = [
  "index.html",
  "service-worker.js"
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(DIST, item));
  }

  console.log("Built Rockism into", DIST);
}

main();
