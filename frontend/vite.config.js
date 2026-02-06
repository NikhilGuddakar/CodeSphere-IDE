import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js"
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          codemirror: [
            "@uiw/react-codemirror",
            "@uiw/codemirror-theme-vscode",
            "@codemirror/view",
            "@codemirror/lang-javascript",
            "@codemirror/lang-python",
            "@codemirror/lang-java"
          ]
        }
      }
    }
  }
});
