import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { SyncPayload } from "../src/api/feishuSync"
import { 
  legacyHeaderRow as headerRow, 
  buildRecordBlock, 
  blockToCsv,
  monthTabTitle, 
  rowToCsv, 
  buildRecordOps as buildMonthInitOps, 
  buildRecordOps as buildGameRowOps,
  legacyBuildMonthInitOps
} from "./recordBlock"
import { quarterKeyOf, quarterLater, readConfigSeason, archiveRowFor, rankResetRows, archiveHeaderRow, CONFIG_SEASON_CELL, CONFIG_SEASON_LABEL } from "./seasonArchive"

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

// 测试同步：不改数据，仅确认服务可达
app.post("/api/sync-test", (c) => c.json({ ok: true, test: true }))

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
/** 旧「每局复盘记录」tab（卡片格式历史数据），仅用于 gameId 幂等去重扫描 */
const LEGACY_RECORD_SHEET_ID = process.env.SYNC_RECORD_SHEET_ID || "1mQAkr"
/** 「历赛季前三」tab 标题（同工作簿内自动创建） */
const SEASONS_TAB_TITLE = "历赛季前三"

/** CSV 转义单元格 */
function csvCell(v: string | number): string {
  const s = String(v ?? "")
  return `"${s.replace(/"/g, '""')}"`
}

/** 读子表数据，返回二维数组（从 A1 行 1 起，含表头） */
async function readSheet(sheetId: string, range = "A1:N5000"): Promise<(string | number)[][]> {
  const r = await runLark([
    "sheets",
    "+csv-get",
    "--url",
    SPREADSHEET_URL,
    "--sheet-id",
    sheetId,
    "--range",
    range,
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

/** 工作簿内所有子表：title → sheet_id */
async function workbookSheets(): Promise<Map<string, string>> {
  const r = await runLark(["sheets", "+workbook-info", "--url", SPREADSHEET_URL, "--format", "json"])
  if (!r.ok) throw new Error(r.error?.message || "读取工作簿失败")
  const map = new Map<string, string>()
  for (const s of r.data?.sheets ?? []) {
    const title = s?.title ?? s?.sheet_name ?? ""
    if (title && s?.sheet_id) map.set(title, s.sheet_id)
  }
  return map
}

/**
 * 确保某标题的 tab 存在；不存在则创建 + 写入表头/配置 + 初始化样式（一次），
 * 返回 { sheetId, created }。
 */
async function ensureSheetByTitle(
  title: string,
  headerCsv: string,
  initOps: (sheetId: string) => { shortcut: string; input: Record<string, unknown> }[],
): Promise<{ sheetId: string; created: boolean }> {
  const sheets = await workbookSheets()
  const existing = sheets.get(title)
  if (existing) return { sheetId: existing, created: false }
  const create = await runLark(["sheets", "+sheet-create", "--url", SPREADSHEET_URL, "--title", title, "--row-count", "5000", "--col-count", "14", "--format", "json"])
  if (!create.ok) throw new Error(create.error?.message || `创建 tab「${title}」失败`)
  // 创建后重新列工作簿拿新 tab 的 sheet_id（不依赖创建响应结构）
  const after = await workbookSheets()
  const sheetId = after.get(title)
  if (!sheetId) throw new Error(`创建 tab「${title}」后未能定位 sheet_id`)
  // 写表头/配置 + 初始化样式（合并、列宽、冻结等）
  const writeHeader = await runLark(["sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", sheetId, "--start-cell", "A1", "--csv", headerCsv, "--format", "json"])
  if (!writeHeader.ok) throw new Error(writeHeader.error?.message || `写 tab「${title}」表头失败`)
  const r = await runLark(["sheets", "+batch-update", "--url", SPREADSHEET_URL, "--operations", JSON.stringify(initOps(sheetId)), "--format", "json"])
  if (!r.ok) throw new Error(r.error?.message || `初始化 tab「${title}」失败`)
  return { sheetId, created: true }
}

/** 确保本月复盘 tab 存在（表头 + 深蓝样式 + 列宽 + 冻结首行） */
async function ensureMonthTab(date: string): Promise<string> {
  const title = monthTabTitle(date)
  const r = await ensureSheetByTitle(title, headerRow().map(csvCell).join(","), (sid) => legacyBuildMonthInitOps(sid))
  return r.sheetId
}

/** 确保「历赛季前三」tab 存在（表头 A1:H1 + 配置标签 I1），返回 sheet_id */
async function ensureSeasonsTab(): Promise<string> {
  const header = archiveHeaderRow().map(csvCell).join(",")
  const labelCells = new Array<string>(10).fill("")
  labelCells[8] = csvCell(CONFIG_SEASON_LABEL)
  const headerCsv = `${header}\n${labelCells.join(",")}`
  const r = await ensureSheetByTitle(SEASONS_TAB_TITLE, headerCsv, (sid) => [
    {
      shortcut: "+cells-set-style",
      input: {
        sheet_id: sid,
        range: "A1:H1",
        background_color: "#1668dc",
        font_color: "#ffffff",
        font_weight: "bold",
        font_size: 11,
        horizontal_alignment: "center",
        vertical_alignment: "middle",
      },
    },
    { shortcut: "+cols-resize", input: { sheet_id: sid, widths: JSON.stringify({ A: 130, B: 160, C: 100, D: 100, E: 100, F: 100, G: 100, H: 100, I: 90, J: 100 }) } },
  ])
  return r.sheetId
}

/** 同步对局数据到飞书表格 */
app.post("/api/sync-feishu", async (c) => {
  try {
    const body = (await c.req.json()) as SyncPayload
    if (!body.players?.length) return c.json({ error: "players 不能为空" }, 400)
    const gameId = String(body.gameId || "").trim()

    // 0. 幂等去重：gameId 已落在当月复盘 tab 或旧复盘 tab 的 A 列 = 已同步
    const monthTabId = await ensureMonthTab(body.date)
    const monthRows = await readSheet(monthTabId, "A1:A3000")
    if (gameId && monthRows.some((r) => String(r[0] ?? "").trim() === gameId)) return c.json({ ok: true })
    if (gameId) {
      const legacyRows = await readSheet(LEGACY_RECORD_SHEET_ID, "A1:A5000")
      if (legacyRows.some((r) => String(r[0] ?? "").trim() === gameId)) return c.json({ ok: true })
    }

    // 1. 季度存档 + 排名清零：新季度首局同步时，先留存上季度前三名，再清零开新赛季
    const seasonKey = quarterKeyOf(body.date)
    let rankRows = await readSheet(RANK_SHEET_ID, "A1:K200")
    if (seasonKey) {
      const seasonsId = await ensureSeasonsTab()
      const seasonsRows = await readSheet(seasonsId, "A1:J100")
      const cur = readConfigSeason(seasonsRows)
      if (cur) {
        if (quarterLater(seasonKey, cur)) {
          // 上季度（cur）前三名 →「历赛季前三」追加一行
          const archRow = archiveRowFor(rankRows.slice(1), cur, new Date().toLocaleString())
          const sNext = lastDataRow(seasonsRows) + 1
          const writeArch = await runLark([
            "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", seasonsId,
            "--start-cell", `A${sNext}`, "--csv", rowToCsv(archRow), "--format", "json",
          ])
          if (!writeArch.ok) throw new Error(writeArch.error?.message || "写季度前三失败")
          // 排行榜清零（场次/胜/负/胜率/积分归零，排名重排；保留名单）
          const resetRows = rankResetRows(rankRows)
          const writeReset = await runLark([
            "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", RANK_SHEET_ID,
            "--start-cell", "A1", "--csv", resetRows.map((r) => r.map(csvCell).join(",")).join("\n"), "--format", "json",
          ])
          if (!writeReset.ok) throw new Error(writeReset.error?.message || "赛季清零失败")
          rankRows = resetRows
          // 更新当前赛季标记
          const writeCfg = await runLark([
            "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", seasonsId,
            "--start-cell", CONFIG_SEASON_CELL, "--csv", csvCell(seasonKey), "--format", "json",
          ])
          if (!writeCfg.ok) throw new Error(writeCfg.error?.message || "更新当前赛季失败")
        }
      } else {
        // 首跑：仅写入当前赛季基线（不清零、不补存档，避免误清历史累计）
        await runLark([
          "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", seasonsId,
          "--start-cell", CONFIG_SEASON_CELL, "--csv", csvCell(seasonKey), "--format", "json",
        ])
      }
    }

    // 2. 更新排名：在清零后的账面基础上按昵称累加，就地改/追加
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
        "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", RANK_SHEET_ID,
        "--start-cell", `C${u.row}`, "--csv", u.vals.map((v) => csvCell(v)).join(","), "--format", "json",
      ])
      if (!r.ok) throw new Error(r.error?.message || "更新排名失败")
    }
    if (appends.length) {
      const start = lastDataRow(rankRows) + 1
      const r = await runLark([
        "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", RANK_SHEET_ID,
        "--start-cell", `A${start}`, "--csv", appends.join("\n"), "--format", "json",
      ])
      if (!r.ok) throw new Error(r.error?.message || "追加玩家失败")
    }

    // 3. 本局写入当月复盘 tab（表头下追加一行 + 行样式）
    const nextRow = lastDataRow(monthRows) + 1
    const block = buildRecordBlock(body, nextRow)
    const writeRow = await runLark([
      "sheets", "+csv-put", "--url", SPREADSHEET_URL, "--sheet-id", monthTabId,
      "--start-cell", `A${nextRow}`, "--csv", blockToCsv(block), "--format", "json",
    ])
    if (!writeRow.ok) throw new Error(writeRow.error?.message || "写复盘失败")
    const styleRow = await runLark([
      "sheets", "+batch-update", "--url", SPREADSHEET_URL,
      "--operations", JSON.stringify(buildGameRowOps(block, monthTabId)), "--format", "json",
    ])
    if (!styleRow.ok) throw new Error(styleRow.error?.message || "复盘行样式失败")

    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🛰️ 飞书群成员桥接服务已启动: http://localhost:${info.port}`)
  console.log(`📊 飞书表格同步已启用: ${SPREADSHEET_URL}`)
})
