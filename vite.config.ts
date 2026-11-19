/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset paths: GitHub Pages serves a project site from /<repo-name>/, and this keeps
  // the build working there (or anywhere else) without hard-coding the repository name.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    // The API's dev-profile CORS defaults already allow http://localhost:5173.
    port: 5173,
  },
  test: {
    environment: "jsdom",
  },
});
