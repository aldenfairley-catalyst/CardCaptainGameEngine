import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages repo: https://github.com/aldenfairley-catalyst/CardCaptainGameEngine
  // Site is hosted at: https://aldenfairley-catalyst.github.io/CardCaptainGameEngine/
  base: "/CardCaptainGameEngine/",
});
