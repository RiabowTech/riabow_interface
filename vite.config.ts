/// <reference types="vitest" />

import { lingui } from "@lingui/vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer";
import { analyzer } from "vite-bundle-analyzer";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, loadEnv, type PluginOption } from "vite";

import { BREAKPOINTS } from "./src/shared/lib/breakpoints";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const root = path.dirname(fileURLToPath(import.meta.url));
  const env = loadEnv(mode, root, "");
  return {
    worker: {
      format: "es",
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            $screen-md: ${BREAKPOINTS.mobile}px;
            $screen-lg: ${BREAKPOINTS.tablet}px;
            $screen-xl: ${BREAKPOINTS.desktop}px;
            $screen-sm: ${BREAKPOINTS.smallMobile}px;
          `,
        },
      },
    },
    server: {
      host: true,
      proxy: {
        "/api": {
          // 支持通过环境变量切换：VITE_PROXY_API_URL
          target: env.VITE_PROXY_API_URL || "https://api.primit.io",
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          // 支持通过环境变量切换：VITE_PROXY_WS_URL
          target: env.VITE_PROXY_WS_URL || "wss://api.primit.io",
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        "/ws/external": {
          // 支持通过环境变量切换：VITE_PROXY_WS_URL
          target: env.VITE_PROXY_WS_URL || "wss://api.primit.io",
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    plugins: [
      svgr({
        include: "**/*.svg?react",
      }),
      tsconfigPaths(),
      react({
        babel: {
          plugins: ["macros"],
        },
      }),
      lingui(),
      visualizer() as PluginOption,
      mode === "analyze" && analyzer(),
    ],
    resolve: {
      alias: {
        // New module structure aliases
        "@": path.resolve(__dirname, "src"),
        "@/modules": path.resolve(__dirname, "src/modules"),
        "@/shared": path.resolve(__dirname, "src/shared"),
        "@/app": path.resolve(__dirname, "src/app"),
        // App directory alias
        app: path.resolve(__dirname, "src/app"),
        components: path.resolve(__dirname, "src/shared/components"),
        config: path.resolve(__dirname, "src/shared/config"),
        domain: path.resolve(__dirname, "src/modules/lighter/domain"),
        fonts: path.resolve(__dirname, "src/shared/fonts"),
        img: path.resolve(__dirname, "src/shared/img"),
        lib: path.resolve(__dirname, "src/shared/lib"),
        locales: path.resolve(__dirname, "src/shared/locales"),
        modules: path.resolve(__dirname, "src/modules"),
        shared: path.resolve(__dirname, "src/shared"),
        styles: path.resolve(__dirname, "src/shared/styles"),
        // Typechain types moved to modules/lighter/contracts
        "typechain-types": path.resolve(__dirname, "src/modules/lighter/contracts/typechain-types"),
        "typechain-types-stargate": path.resolve(__dirname, "src/modules/lighter/contracts/typechain-types-stargate"),
        sdk: path.resolve(__dirname, "src/shared/sdk"),
      },
    },
    build: {
      assetsInlineLimit: 0,
      outDir: "build",
      // Source maps:
      //   dev / non-prod   → inline for DX
      //   production build → `false` (was `true`, which shipped full TS sources
      //     alongside the bundle, effectively open-sourcing the app to anyone
      //     loading /assets/*.js.map). If we ever want decoded stack traces
      //     in Sentry, switch to "hidden" and add `@sentry/vite-plugin` to
      //     upload the maps to Sentry (not to the CDN).
      sourcemap: mode === "production" ? false : true,
      rollupOptions: {
        output: {
          manualChunks: {
            web3: ["ethers", "viem", "date-fns", "@rainbow-me/rainbowkit", "lodash", "@gelatonetwork/relay-sdk"],
            charts: ["recharts"],
            ui: ["@headlessui/react", "framer-motion", "react-select"],
          },
        },
      },
    },
    test: {
      environment: "happy-dom",
      globalSetup: "./vitest.global-setup.js",
      exclude: ["./autotests", "node_modules", "./sdk"],
      setupFiles: ["@vitest/web-worker"],
    },
  };
});
