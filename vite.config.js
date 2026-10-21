import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",

  server: {
    proxy: {
      "/api": {
        target: "https://hq.jnrplasteringandbuilding.com",
        changeOrigin: true,
        secure: true,
      },

      "/jobs": {
        target: "https://hq.jnrplasteringandbuilding.com",
        changeOrigin: true,
        secure: true,
      },

      "/timeline-points": {
        target: "https://hq.jnrplasteringandbuilding.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
