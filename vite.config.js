import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve } from "path";

export default defineConfig({
    base: "./",
    server: {
        allowedHosts: ["alqaba.a.pinggy.link"],
    },
    optimizeDeps: {
        exclude: ["@babylonjs/havok"],
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                credits: resolve(__dirname, "credits.html"),
            },
        },
    },
    plugins: [
        ...(process.env.ANALYZE
            ? [
                  visualizer({
                      open: false,
                      filename: "dist/stats.html",
                      gzipSize: true,
                      brotliSize: true,
                  }),
              ]
            : []),
    ],
});
