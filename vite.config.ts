import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createResearchApi } from "./server/research.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: "research-api",
      configureServer(server) {
        server.middlewares.use(createResearchApi());
      },
    },
    {
      name: "react-edition-html",
      apply: "build",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          // Built HTML uses React even under file://. Remove fallback controllers
          // before Vite processes scripts so they cannot retain stale DOM listeners.
          const reactOnly = html.replace(/\s*<script\b[^>]*\bdata-static-only\b[^>]*>[\s\S]*?<\/script>/gi, "");
          const bootstrap = /<script type="module" data-react-bootstrap>[\s\S]*?<\/script>/;
          if (!bootstrap.test(reactOnly)) throw new Error("Missing React edition bootstrap");
          return reactOnly.replace(bootstrap, '<script type="module" src="./src/main.tsx"></script>');
        },
      },
    },
    react(),
    tailwindcss(),
    viteSingleFile(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
