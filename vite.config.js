import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
    server: {
        allowedHosts: ["alqaba.a.pinggy.link"],
    },
    optimizeDeps: {
        exclude: ["@babylonjs/havok"],
    },
    plugins: [
        visualizer({
            open: false,
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
        }),
    ],
});
