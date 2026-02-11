import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [
    react(),
    glsl()
  ],
  base: process.env.GITHUB_PAGES ? "/Ontik-vr-shader-experience/" : "/",
  root: path.resolve(import.meta.dirname, "client"),
  css: {
    postcss: {
      plugins: [
        tailwindcss(path.resolve(import.meta.dirname, "tailwind.config.cjs")),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
  },
});
