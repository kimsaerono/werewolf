import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const PORT = Number(process.env.PORT || 3457)

function larkBin(): string {
  if (process.env.LARK_CLI) return process.env.LARK_CLI
  const local = fileURLToPath(new URL("../node_modules/.bin/lark-cli", import.meta.url))
  if (existsSync(local)) return local
  return "lark-cli"
}

interface LarkResult {
  ok: boolean
  data?: any
  error?: any
}

function runLark(args: string[]): Promise<LarkResult> {
  return new Promise((resolve) => {
    const p = spawn(larkBin(), args, { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    p.stdout.on("data", (d: Buffer) => (out += d.toString()))
    p.stderr.on("data", (d: Buffer) => (err += d.toString()))
    p.on("error", (e: Error) => resolve({ ok: false, error: { message: `无法启动 lark-cli: ${e.message}` } }))
    p.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve({ ok: false, error: { message: err.trim() || `lark-cli 退出码 ${code}` } })
        return
      }
      try {
        const idx = out.indexOf("{")
        const json = idx >= 0 ? out.slice(idx) : out
        resolve(JSON.parse(json) as LarkResult)
      } catch {
        resolve({ ok: false, error: { message: `解析 lark-cli 输出失败：${out.slice(0, 200)}` } })
      }
    })
  })
}

const app = new Hono()

app.get("/api/health", (c) => c.json({ ok: true }))

app.get("/api/chats", async (c) => {
  const query = c.req.query("query") || ""
  if (!query.trim()) return c.json({ error: "query 不能为空" }, 400)
  const r = await runLark([
    "im",
    "+chat-search",
    "--query",
    query.trim(),
    "--page-size",
    "20",
    "--format",
    "json",
  ])
  if (!r.ok) return c.json({ error: r.error?.message || "搜索失败" }, 500)
  const chats: any[] = (r.data?.chats ?? []).map((ch: any) => ({
    chat_id: ch.chat_id,
    name: ch.name,
    member_count: ch.member_count,
  }))
  return c.json({ chats })
})

app.get("/api/members", async (c) => {
  const chatId = c.req.query("chatId") || ""
  if (!chatId) return c.json({ error: "chatId 不能为空" }, 400)
  const r = await runLark([
    "im",
    "+chat-members-list",
    "--chat-id",
    chatId,
    "--member-types",
    "user",
    "--page-all",
    "--format",
    "json",
  ])
  if (!r.ok) return c.json({ error: r.error?.message || "获取成员失败" }, 500)
  const users: any[] = (r.data?.users ?? []).map((u: any) => ({ member_id: u.member_id, name: u.name }))
  return c.json({ users })
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🛰️ 飞书群成员桥接服务已启动: http://localhost:${info.port}`)
})
