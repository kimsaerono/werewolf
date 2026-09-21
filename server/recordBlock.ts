/** 「每月复盘记录」表格构建器（纯函数，供本地桥接与测试共用）
 *
 * 布局 F（5 列 A..E，默认）：
 *   每局 = 一行一个合并块（A:E），左对齐；内容按顺序逐行：
 *   局次(title) → 时间/板子/胜负/原因/法官/荣誉 → 玩家积分(一人一行) → 对局日志(逐条)
 *   行高按实际行数计算撑高
 * 首行为固定表头（深蓝底白字加粗 + 冻结首行）；数据行积分/日志列自动换行、行高 auto。
 *
 * 布局 G（5 列 A..E，默认）：
 *   每局 = 双行（标题行 + 内容行），各自 A:E 合并
 *   标题行：蓝底、左对齐、36px；内容：日期 第N局 🧑‍⚖️ 法官：xxx 胜负
 *   内容行：左对齐、自动换行、最低 400px
 *   首行无表头，数据从第 1 行开始
 *
 * 兼容层（旧 14 列卡片布局 LEGACY）：
 *   供本地桥接 server/index.ts 使用，结构与旧版一致（14 列 A..N 卡片式）
 */
import type { SyncPayload } from "../src/api/feishuSync"

/** 分数展示：保留 1 位小数，正数带 + 号 */
export function fmtScore(n: number): string {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`
}

export interface Layout {
  name: string
  cols: number
  slots: Record<string, number>
  labels: Record<string, string>
  widths: Record<string, number>
  headerStyle: string
  mergesFor: (row: number) => string[]
  wrapCols: string
}

export const LAYOUTS: Record<string, Layout> = {
  F: {
    name: "F",
    cols: 5,
    slots: { block: 0 },
    labels: { block: "对局记录" },
    widths: { A: 250, B: 250, C: 250, D: 250, E: 250 },
    headerStyle: "A1:E1",
    mergesFor: (row: number) => [`A${row}:E${row}`],
    wrapCols: "A:E",
  },
  G: {
    name: "G",
    cols: 5,
    slots: { title: 0, body: 0 },
    labels: { title: "标题", body: "内容" },
    widths: { A: 250, B: 250, C: 250, D: 250, E: 250 },
    headerStyle: "A1:E1",
    mergesFor: (row: number) => [`A${row}:E${row}`],
    wrapCols: "A:E",
  },
}

export const DEFAULT_LAYOUT = "G"

export function layoutFor(name: string): Layout {
  return LAYOUTS[name] ?? LAYOUTS[DEFAULT_LAYOUT]
}

/** 月份 key：YYYY-MM（空/解析失败返回 ""） */
export function monthKeyOf(date: string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** 月度复盘 tab 标题：YYYY-MM复盘 */
export function monthTabTitle(date: string): string {
  const m = monthKeyOf(date)
  return m ? `${m}复盘` : "未知月复盘"
}

/** 表头行（合并格值落在起始格）— 支持可选 layoutName，默认 DEFAULT_LAYOUT */
export function headerRow(layoutName?: string): string[] {
  const L = layoutFor(layoutName ?? DEFAULT_LAYOUT)
  const row = new Array<string>(L.cols).fill("")
  for (const [k, v] of Object.entries(L.labels)) row[L.slots[k]] = v
  return row
}

/** 单局数据行（积分/日志值落在起始格）— 布局 F 单行 */
export function gameRow(payload: SyncPayload, layoutName: string): string[] {
  payload = payload || {}
  const L = layoutFor(layoutName)
  const row = new Array<string>(L.cols).fill("")
  const s = L.slots
  // 对局日志 = 局次+日期(标题行，精确到日时分) + 基础信息(各占一行) + 玩家积分(一人一行) + 逐条日志
  const g = payload.gameId
  const d = payload.date
  const hasDateInGid = g && /(年|\d+\/)/.test(String(g)) // gameId 已自带日期则直接用
  const titleText = hasDateInGid ? String(g) : [g, d].filter(Boolean).join("｜")
  const block = [`🎮 ${titleText || "-"}`]
  if (!d) block.push(`🕐 时间：-`)
  block.push(`🃏 板子：${payload.boardFinal || payload.board || "-"}`)
  block.push(`⚔️ 胜负：${payload.winner || "-"}`)
  block.push(`📋 原因：${payload.reason || "-"}`)
  block.push(`🧑‍⚖️ 法官：${(payload.judge && payload.judge.name) || "-"}`)
  const honors = [
    payload.mvp ? `MVP:${payload.mvp}` : "",
    payload.svp ? `SVP:${payload.svp}` : "",
    payload.beiguo ? `背锅侠:${payload.beiguo}` : "",
  ].filter(Boolean)
  if (honors.length) block.push(`🏅 荣誉：${honors.join("　")}`)
  const players = payload.players || []
  if (players.length) {
    block.push("")
    block.push("🎯 玩家积分")
    for (const p of players) block.push(` ${p.no}.${p.name}(${p.role}) ${fmtScore(p.base + p.skill + p.vote)}`)
  }
  const lg = payload.logLines || []
  if (lg.length) {
    block.push("")
    block.push("📜 对局日志")
    for (let i = 0; i < lg.length; i++) block.push(` ${i + 1}. ${lg[i]}`)
  }
  row[s.block] = block.join("\n")
  return row
}

/** 单局双行数据（标题行+内容行）— 布局 G */
export function gameRows(payload: SyncPayload, layoutName: string): [string[], string[]] {
  payload = payload || {}
  const L = layoutFor(layoutName)
  const s = L.slots
  const d = payload.date
  const g = payload.gameId
  // 提取局数：从 gameId 解析 "第N局" 或 "第N局 · 日期"
  let ju = ""
  if (g) {
    const m = String(g).match(/第(\d+)局/)
    if (m) ju = `第${m[1]}局`
  }
  const judgeName = (payload.judge && payload.judge.name) || "-"
  const winCamp = payload.winner || "-"
  const timePart = d ? d.replace(" ", " ") : "-"
  const titleText = `${timePart}  ${ju}  🧑‍⚖️ 法官：${judgeName}  ${winCamp}`.trim()
  const titleRow = new Array<string>(L.cols).fill("")
  titleRow[s.title] = titleText

  // 内容行：板子/胜负/原因/法官/荣誉 → 玩家积分 → 对局日志
  const block: string[] = []
  block.push(`🃏 板子：${payload.boardFinal || payload.board || "-"}`)
  block.push(`⚔️ 胜负：${payload.winner || "-"}`)
  block.push(`📋 原因：${payload.reason || "-"}`)
  block.push(`🧑‍⚖️ 法官：${judgeName}`)
  const honors = [
    payload.mvp ? `MVP:${payload.mvp}` : "",
    payload.svp ? `SVP:${payload.svp}` : "",
    payload.beiguo ? `背锅侠:${payload.beiguo}` : "",
  ].filter(Boolean)
  if (honors.length) block.push(`🏅 荣誉：${honors.join("　")}`)
  const players = payload.players || []
  if (players.length) {
    block.push("")
    block.push("🎯 玩家积分")
    for (const p of players) block.push(` ${p.no}.${p.name}(${p.role}) ${fmtScore(p.base + p.skill + p.vote)}`)
  }
  const lg = payload.logLines || []
  if (lg.length) {
    block.push("")
    block.push("📜 对局日志")
    for (let i = 0; i < lg.length; i++) block.push(` ${i + 1}. ${lg[i]}`)
  }
  const bodyRow = new Array<string>(L.cols).fill("")
  bodyRow[s.body] = block.join("\n")
  return [titleRow, bodyRow]
}

/** 表头行合并范围（A1 绝对地址，行号 1 起） */
export function headerMerges(layoutName: string): string[] {
  return layoutFor(layoutName).mergesFor(1)
}

/** 数据行合并范围（A1 绝对地址） */
export function rowMerges(row: number, layoutName: string): string[] {
  return layoutFor(layoutName).mergesFor(row)
}

/** CSV 单元格转义（RFC 4180：整格引号包裹、内部引号翻倍） */
export function csvCell(v: string): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

/** 单行 → CSV 文本 */
export function rowToCsv(row: string[]): string {
  return row.map(csvCell).join(",")
}

/** 新建月度 tab 的初始化 ops（合并 + 表头样式 + 列宽 + 行高 + 冻结），为每个 tab 建一次 */
export function buildMonthInitOps(sheetId: string, layoutName: string): { shortcut: string; input: Record<string, unknown> }[] {
  const L = layoutFor(layoutName)
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  // 表头：仅非 G 布局有表头
  if (layoutName !== "G") {
    for (const range of headerMerges(layoutName)) {
      ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
    }
    ops.push({
      shortcut: "+cells-set-style",
      input: {
        sheet_id: sheetId,
        range: L.headerStyle,
        background_color: "#1668dc",
        font_color: "#ffffff",
        font_weight: "bold",
        font_size: 11,
        horizontal_alignment: "center",
        vertical_alignment: "middle",
      },
    })
    ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: "1:1", height: 30 } })
    ops.push({ shortcut: "+dim-freeze", input: { sheet_id: sheetId, dimension: "row", count: 1 } })
  }
  // 列宽（px，逐列）——所有布局都需要
  for (const [letters, px] of Object.entries(L.widths)) {
    ops.push({
      shortcut: "+cols-resize",
      input: { sheet_id: sheetId, widths: JSON.stringify({ [letters]: px }) },
    })
  }
  return ops
}

/** 单局双行 ops：标题行合并+样式(蓝底左对齐36px) + 内容行合并+样式(左对齐400px+自动换行) */
export function buildGameRowOps(sheetId: string, titleRow: number, bodyRow: number, layoutName: string): { shortcut: string; input: Record<string, unknown> }[] {
  const L = layoutFor(layoutName)
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  // 标题行合并 + 样式（蓝底、左对齐、36px、底部留白）
  for (const range of rowMerges(titleRow, layoutName)) {
    ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
  }
  ops.push({
    shortcut: "+cells-set-style",
    input: {
      sheet_id: sheetId,
      range: `A${titleRow}:${L.headerStyle.slice(2)}`.replace(/^\d+/, titleRow.toString()),
      background_color: "#1668dc",
      font_color: "#ffffff",
      font_weight: "bold",
      font_size: 11,
      horizontal_alignment: "left",
      vertical_alignment: "bottom",
      border_styles: JSON.stringify({ bottom: { style: "solid", color: "#1668dc", weight: "thin" } }),
    },
  })
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `${titleRow}:${titleRow}`, height: 36 } })

  // 内容行合并 + 样式（左对齐、边框、自动换行、最低 400px）
  if (bodyRow) {
    for (const range of rowMerges(bodyRow, layoutName)) {
      ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
    }
    ops.push({
      shortcut: "+cells-set-style",
      input: {
        sheet_id: sheetId,
        range: `A${bodyRow}:${L.headerStyle.slice(2)}`.replace(/^\d+/, bodyRow.toString()),
        font_size: 11,
        horizontal_alignment: "left",
        vertical_alignment: "top",
        border_styles: JSON.stringify({ borderAll: { color: "#e5e7eb", style: "SOLID" } }),
      },
    })
    ops.push({
      shortcut: "+cells-set-style",
      input: { sheet_id: sheetId, range: `A${bodyRow}:E${bodyRow}`, vertical_alignment: "top", word_wrap: "auto-wrap" },
    })
    ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `${bodyRow}:${bodyRow}`, type: "auto", min_height: 400 } })
  }
  return ops
}

/* ============================================================
 * 兼容层：旧 14 列卡片布局（LEGACY）
 * 结构：A 局次 | B 时间 | C 板子 | D 胜负 | E 原因 | F 法官 | G 荣誉 | H:I 玩家积分 | J:N 对局日志
 * 卡片式：每局 4-6 行，标题行合并 B:N，信息行、积分行、日志行各占一行，末尾空行分隔
 * 供本地桥接 server/index.ts 使用，保持与旧版行为一致
 * ============================================================ */

export const RECORD_COLS = 14

/** 旧版表头行（14 列；合并格 H/I、J:N 的值分别落在 H、J） */
export function legacyHeaderRow(): string[] {
  const row: string[] = new Array<string>(RECORD_COLS).fill("")
  row[0] = "局次"
  row[1] = "时间"
  row[2] = "板子"
  row[3] = "胜负"
  row[4] = "原因"
  row[5] = "法官"
  row[6] = "荣誉"
  row[7] = "玩家积分"
  row[9] = "对局日志"
  return row
}

/** 旧版单局卡片区块构建器 */
export function buildRecordBlock(payload: SyncPayload, startRow: number) {
  const board = payload.boardFinal || payload.board || "-"
  const title = `🎮 ${board}板 ｜ ${payload.winner || "-"}${payload.reason ? `（${payload.reason}）` : ""} ｜ 法官：${(payload.judge && payload.judge.name) || "-"}`
  const infoParts = [`⏰ 时间：${payload.date || "-"}`]
  const honors = [
    payload.mvp ? `🏆 MVP：${payload.mvp}` : "",
    payload.svp ? `SVP：${payload.svp}` : "",
    payload.beiguo ? `背锅侠：${payload.beiguo}` : "",
  ].filter(Boolean)
  if (honors.length) infoParts.push(honors.join(" ｜ "))
  const scoreLine = (payload.players || []).length
    ? `积分：` +
      (payload.players || [])
        .map((p) => `${p.no}.${p.name}(${p.role}) ${fmtScore(p.base + p.skill + p.vote)}`)
        .join("　")
    : ""
  const lines = payload.logLines || []

  const rows = [
    [String(payload.gameId || ""), title],
    ["", infoParts.join(" ｜ ")],
    ...(scoreLine ? [["", scoreLine]] : []),
    ...lines.map((l, i) => ["", `${i + 1}. ${l}`]),
    ["", ""],
  ]
  const logStart = startRow + (scoreLine ? 3 : 2)
  return {
    rows,
    mergeRanges: [`B${startRow}:N${startRow}`],
    titleRow: startRow,
    logStartRow: logStart,
    logEndRow: logStart - 1 + lines.length,
  }
}

/** 旧版卡片区块 ops：合并/样式/行高 */
export function buildRecordOps(block: ReturnType<typeof buildRecordBlock>, sheetId: string) {
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  for (const range of block.mergeRanges) {
    ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
  }
  const styleData = [
    {
      ranges: [`${sheetId}!A${block.titleRow}:N${block.titleRow}`],
      style: {
        backColor: "#1668dc",
        foreColor: "#ffffff",
        font: { bold: true, fontSize: "11pt/1.5" },
        vAlign: 1,
        borderType: "BOTTOM_BORDER",
        borderColor: "#0d4a9e",
      },
    },
    {
      ranges: [`${sheetId}!B${block.titleRow + 1}:B${block.logStartRow - 1}`],
      style: { foreColor: "#6b7280", vAlign: 0 },
    },
  ]
  if (block.logEndRow >= block.logStartRow) {
    styleData.push({
      ranges: [`${sheetId}!B${block.logStartRow}:B${block.logEndRow}`],
      style: { foreColor: "#8a8f99", vAlign: 0 },
    })
  }
  ops.push({
    shortcut: "+cells-set-style",
    input: { data: styleData },
  })
  ops.push({
    shortcut: "+rows-resize",
    input: { range: `${block.titleRow}:${block.titleRow}`, height: 30 },
  })
  if (block.logEndRow >= block.logStartRow) {
    ops.push({
      shortcut: "+rows-resize",
      input: { range: `${block.logStartRow}:${block.logEndRow}`, height: 20 },
    })
  }
  ops.push({
    shortcut: "+rows-resize",
    input: { range: `${block.titleRow + block.rows.length - 1}:${block.titleRow + block.rows.length - 1}`, height: 10 },
  })
  return ops
}

/** 旧版：块转 CSV（仅取 B 列内容，A 列只在首行有 gameId） */
export function blockToCsv(block: ReturnType<typeof buildRecordBlock>): string {
  return block.rows.map((r) => r.map(csvCell).join(",")).join("\n")
}

/** 旧版月度 tab 初始化 ops（表头合并/样式/列宽/冻结） */
export function legacyBuildMonthInitOps(sheetId: string): { shortcut: string; input: Record<string, unknown> }[] {
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  // 表头合并 B1:N1
  ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range: "B1:N1" } })
  // 表头样式：深蓝底白字加粗居中
  ops.push({
    shortcut: "+cells-set-style",
    input: {
      sheet_id: sheetId,
      range: "A1:N1",
      background_color: "#1668dc",
      font_color: "#ffffff",
      font_weight: "bold",
      font_size: 11,
      horizontal_alignment: "center",
      vertical_alignment: "middle",
    },
  })
  // 列宽：A=150 B=150 C=170 D=100 E=100 F=100 G=150 H:I=200 J:N=400
  ops.push({
    shortcut: "+cols-resize",
    input: { sheet_id: sheetId, widths: JSON.stringify({ A: 150, B: 150, C: 170, D: 100, E: 100, F: 100, G: 150, "H:I": 200, "J:N": 400 }) },
  })
  ops.push({ shortcut: "+rows-resize", input: { range: "1:1", height: 30 } })
  ops.push({ shortcut: "+dim-freeze", input: { sheet_id: sheetId, dimension: "row", count: 1 } })
  return ops
}