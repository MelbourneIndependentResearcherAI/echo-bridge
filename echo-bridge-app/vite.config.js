import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // During local dev, run `netlify dev` instead of `vite` directly
      // so /.netlify/functions/* routes actually work. This proxy is a
      // fallback if you run `vite` alone against a locally running
      // functions server on port 9999 (netlify functions:serve).
      "/.netlify/functions": "http://localhost:9999",
    },
  },
});
