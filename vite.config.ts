import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import { fileURLToPath, URL } from "node:url"
import { execSync } from "node:child_process"

function getVersion(): string {
  try {
    return execSync("git describe --tags --always --dirty", { encoding: "utf-8" }).trim()
  } catch {
    return "unknown"
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // 开发代理目标：VITE_SYNC_PROXY_TARGET 优先，否则取 VITE_SYNC_URL 的源，兜底仓库默认
  const target = env.VITE_SYNC_PROXY_TARGET || (env.VITE_SYNC_URL || "").replace(/\/werewolf-sync\/?$/, "") || "https://hymallbosstest.heemoney.com"
  return {
    base: "/werewolf/",
    plugins: [vue()],
    define: {
      __APP_VERSION__: JSON.stringify(getVersion()),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": "http://localhost:3457",
        // 同步接口走本地代理，避免浏览器 CORS；changeOrigin 保证后端拿到正确 Origin
        "/werewolf-sync": {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
