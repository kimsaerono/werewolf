#!/usr/bin/env bun
/**
 * 服务监督进程（supervisor）。
 *
 * 用途：让「切换版本」后自动重启生效。
 * - 拉起真正的服务进程 server/index.ts
 * - 当子进程以退出码 42 退出（版本切换信号）时，自动重新拉起
 * - 其它退出码则一并退出（避免崩溃后无限重启）
 *
 * 之所以不直接让 index.ts 自我重启：dev 下由 concurrently -k 管理，
 * 主进程退出会连带杀掉 vite。用一个常驻 supervisor 包裹即可两全。
 */
import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"

const ENTRY = fileURLToPath(new URL("./index.ts", import.meta.url))
const RESTART_CODE = 42

let child: ChildProcess | null = null
let shuttingDown = false

function start() {
  child = spawn(process.execPath, [ENTRY], { stdio: "inherit", env: process.env })
  child.on("exit", (code) => {
    if (shuttingDown) return
    if (code === RESTART_CODE) {
      console.log("\n♻️  检测到版本切换，正在重启服务...\n")
      start()
    } else {
      process.exit(code ?? 0)
    }
  })
  child.on("error", (err) => {
    console.error("启动服务失败:", err.message)
    process.exit(1)
  })
}

function shutdown(signal: NodeJS.Signals) {
  shuttingDown = true
  child?.kill(signal)
  setTimeout(() => process.exit(0), 200)
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

start()
