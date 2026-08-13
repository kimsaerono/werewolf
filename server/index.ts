import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const PORT = Number(process.env.PORT || 3457)

// 允许 GitHub Pages(https) 跨域访问本地桥接；仅本机 localhost 可达，风险可控
const app = new Hono()
app.use("*", cors())

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

// ===== 飞书表格同步（法官本地桥接） =====
const SPREADSHEET_URL = process.env.SYNC_SHEET_URL || "https://9186.feishu.cn/sheets/K1CFsF33mhOdMTtGuFRcvNrNn6e"
const RANK_SHEET_ID = process.env.SYNC_RANK_SHEET_ID || "2qBCmo"
const RECORD_SHEET_ID = process.env.SYNC_RECORD_SHEET_ID || "1mQAkr"

/** CSV 转义单元格 */
function csvCell(v: string | number): string {
  const s = String(v ?? "")
  return `"${s.replace(/"/g, '""')}"`
}

/** 读子表全部数据，返回二维数组（含表头） */
async function readSheet(sheetId: string): Promise<(string | number)[][]> {
  const r = await runLark([
    "sheets",
    "+csv-get",
    "--url",
    SPREADSHEET_URL,
    "--sheet-id",
    sheetId,
    "--range",
    "A1:K200",
    "--format",
    "json",
  ])
  if (!r.ok) throw new Error(r.error?.message || "读取表格失败")
  const csv: string = r.data?.annotated_csv ?? ""
  const rows: (string | number)[][] = []
  for (const line of csv.split("\n")) {
    const m = line.match(/^\[row=(\d+)\](.*)$/)
    if (!m) continue
    const body = m[2]
    // 简单 CSV 解析（单元格含逗号时被引号包裹）
    const cells: string[] = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < body.length; i++) {
      const ch = body[i]
      if (ch === '"') {
        if (inQ && body[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = !inQ
      } else if (ch === "," && !inQ) {
        cells.push(cur)
        cur = ""
      } else cur += ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  return rows
}

/** 找最后一行有数据的行号（1 起），空表返回 1 */
function lastDataRow(rows: (string | number)[][]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].some((x) => String(x ?? "").trim() !== "")) return i + 1
  }
  return 1
}

/** 同步对局数据到飞书表格 */
app.post("/api/sync-feishu", async (c) => {
  try {
    const body = (await c.req.json()) as {
      gameId: string
      date: string
      board: string
      winCamp: string
      players: { no: number; name: string; role: string; camp: string; win: boolean; base: number; skill: number; vote: number }[]
    }
    if (!body.players?.length) return c.json({ error: "players 不能为空" }, 400)

    // 1. 追加复盘行：从最后数据行的下一行开始
    const recordRows = await readSheet(RECORD_SHEET_ID)
    const nextRow = lastDataRow(recordRows) + 1
    const recordCsv = body.players
      .map((p) =>
        [
          csvCell(body.gameId),
          csvCell(body.date),
          csvCell(body.board),
          csvCell(`${p.no}号`),
          csvCell(p.name),
          csvCell(p.role),
          csvCell(p.camp),
          csvCell(p.win ? "胜" : "负"),
          csvCell(p.base),
          csvCell(p.skill),
          csvCell(p.vote),
        ].join(","),
      )
      .join("\n")
    const appendRec = await runLark([
      "sheets",
      "+csv-put",
      "--url",
      SPREADSHEET_URL,
      "--sheet-id",
      RECORD_SHEET_ID,
      "--start-cell",
      `A${nextRow}`,
      "--csv",
      recordCsv,
      "--format",
      "json",
    ])
    if (!appendRec.ok) throw new Error(appendRec.error?.message || "写复盘失败")

    // 2. 更新排名：读现有，按昵称累加，就地改/追加
    const rankRows = await readSheet(RANK_SHEET_ID)
    const nameToRow = new Map<string, number>()
    for (let i = 0; i < rankRows.length; i++) {
      const nick = String(rankRows[i]?.[1] ?? "").trim()
      if (nick) nameToRow.set(nick, i + 1)
    }
    const agg = new Map<string, { games: number; wins: number; score: number }>()
    for (const p of body.players) {
      if (!p.name) continue
      const cur = agg.get(p.name) ?? { games: 0, wins: 0, score: 0 }
      cur.games++
      if (p.win) cur.wins++
      cur.score += p.base + p.skill + p.vote
      agg.set(p.name, cur)
    }
    // 更新已有行（C 总场次 D 胜 E 负 F 胜率 G 总积分）
    const updates: { row: number; vals: (string | number)[] }[] = []
    for (const [name, a] of agg) {
      const row = nameToRow.get(name)
      if (row && row >= 1 && rankRows[row - 1]) {
        const prev = rankRows[row - 1]
        const g = Number(prev?.[2] ?? 0) + a.games
        const w = Number(prev?.[3] ?? 0) + a.wins
        const l = Number(prev?.[4] ?? 0) + (a.games - a.wins)
        const s = Number(prev?.[6] ?? 0) + a.score
        const rate = g ? `${((w / g) * 100).toFixed(2)}%` : "0.00%"
        updates.push({ row, vals: [g, w, l, rate, s] })
      }
    }
    // 追加新玩家（从最后有数据的行之后开始，避免算到 200 行空白区）
    const appends: string[] = []
    for (const [name, a] of agg) {
      if (nameToRow.has(name)) continue
      const rank = lastDataRow(rankRows) + 1
      const rate = a.games ? `${((a.wins / a.games) * 100).toFixed(2)}%` : "0.00%"
      appends.push([csvCell(rank), csvCell(name), csvCell(a.games), csvCell(a.wins), csvCell(a.games - a.wins), csvCell(rate), csvCell(a.score), csvCell(0), csvCell(0), csvCell("-"), csvCell("-")].join(","))
    }
    for (const u of updates) {
      const r = await runLark([
        "sheets",
        "+csv-put",
        "--url",
        SPREADSHEET_URL,
        "--sheet-id",
        RANK_SHEET_ID,
        "--start-cell",
        `C${u.row}`,
        "--csv",
        u.vals.map((v) => csvCell(v)).join(","),
        "--format",
        "json",
      ])
      if (!r.ok) throw new Error(r.error?.message || "更新排名失败")
    }
    if (appends.length) {
      const start = lastDataRow(rankRows) + 1
      const r = await runLark([
        "sheets",
        "+csv-put",
        "--url",
        SPREADSHEET_URL,
        "--sheet-id",
        RANK_SHEET_ID,
        "--start-cell",
        `A${start}`,
        "--csv",
        appends.join("\n"),
        "--format",
        "json",
      ])
      if (!r.ok) throw new Error(r.error?.message || "追加玩家失败")
    }

    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🛰️ 飞书群成员桥接服务已启动: http://localhost:${info.port}`)
  console.log(`📊 飞书表格同步已启用: ${SPREADSHEET_URL}`)
})
