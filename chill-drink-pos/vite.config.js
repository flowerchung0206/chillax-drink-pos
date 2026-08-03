import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        front: resolve(__dirname, "front.html"),
        kitchen: resolve(__dirname, "kitchen.html"),
      },
    },
  },
});
