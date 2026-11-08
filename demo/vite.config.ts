import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { content } from "./content-plugin.ts";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The site consumes the library from source, so the playground always runs the code in this repo.
// The Node modules below are only reached by the CLI and the file-loading helpers, which the
// playground never calls, so they get small browser stubs.
export default defineConfig({
  root: r("."),
  base: "./",
  plugins: [react(), content()],
  resolve: {
    alias: [
      { find: /^m2aitestkit$/, replacement: r("../src/index.ts") },
      { find: /^node:fs\/promises$/, replacement: r("./src/shims/fs.ts") },
      { find: /^node:path$/, replacement: r("./src/shims/path.ts") },
      { find: /^node:url$/, replacement: r("./src/shims/url.ts") },
      { find: /^node:crypto$/, replacement: r("./src/shims/crypto.ts") },
    ],
  },
  server: { fs: { allow: [r("..")] } },
  build: { outDir: r("dist"), emptyOutDir: true },
});
