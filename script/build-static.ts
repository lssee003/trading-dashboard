/**
 * build-static.ts — Build client-only for GitHub Pages (no server bundle).
 *
 * Usage:  npx tsx script/build-static.ts
 * Assumes script/refresh.ts has already written data/*.json into client/public/data/.
 */

import { build as viteBuild } from "vite";
import { rm } from "fs/promises";
import path from "path";

async function buildStatic() {
  await rm("dist", { recursive: true, force: true });

  console.log("Building static client (VITE_DATA_MODE=static)...");

  await viteBuild({
    mode: "production",
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    define: {
      "import.meta.env.VITE_DATA_MODE": JSON.stringify("static"),
    },
  });

  console.log("Static build complete → dist/public/");
}

buildStatic().catch((err) => {
  console.error(err);
  process.exit(1);
});
