/** 「每月复盘记录」表格构建器（纯函数，供本地桥接与测试共用）
 *
 * 每个游戏月一张子表 tab（如「2026-09复盘」），每局一行，共 14 列 A..N：
 *   A 局次 │ B 时间 │ C 板子 │ D 胜负 │ E 原因 │ F 法官 │ G 荣誉 │ H:I 合并玩家积分 │ J:N 合并对局日志
 * 首行为固定表头（深蓝底白字加粗 + 冻结首行）；数据行全网格浅灰边框，
 * 积分/日志列自动换行、行高 auto（日志多行自动撑高）。
 */
import type { SyncPayload } from "../src/api/feishuSync"

/** 复盘表总列数（A..N） */
export const RECORD_COLS = 14

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

/** 分数展示：保留 1 位小数，正数带 + 号 */
export function fmtScore(n: number): string {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`
}

/** 表头行（14 列；合并格 H/I、J:N 的值分别落在 H、J） */
export function headerRow(): string[] {
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

/** 单局数据行（14 列；积分/日志值落在 H、J） */
export function gameRow(payload: SyncPayload): string[] {
  const row: string[] = new Array<string>(RECORD_COLS).fill("")
  row[0] = payload.gameId
  row[1] = payload.date
  row[2] = payload.boardFinal || payload.board || "-"
  row[3] = payload.winner || "-"
  row[4] = payload.reason || ""
  row[5] = payload.judge?.name || "-"
  const honors = [payload.mvp ? `MVP:${payload.mvp}` : "", payload.svp ? `SVP:${payload.svp}` : "", payload.beiguo ? `背锅侠:${payload.beiguo}` : ""].filter(Boolean)
  row[6] = honors.join("　") || "-"
  row[7] = (payload.players || []).map((p) => `${p.no}.${p.name}(${p.role}) ${fmtScore(p.base + p.skill + p.vote)}`).join("　")
  row[9] = (payload.logLines || []).map((l, i) => `${i + 1}. ${l}`).join("\n")
  return row
}

/** 表头行的合并范围（A1 绝对地址，行号 1 起） */
export const HEADER_MERGES = ["H1:I1", "J1:N1"]

/** 数据行的合并范围（A1 绝对地址） */
export function rowMerges(row: number): string[] {
  return [`H${row}:I${row}`, `J${row}:N${row}`]
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
export function buildMonthInitOps(sheetId: string): { shortcut: string; input: Record<string, unknown> }[] {
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  for (const range of HEADER_MERGES) {
    ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
  }
  // 表头：深蓝底白字加粗居中
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
  // 列宽：A 局次/B 时间/C 板子/D 胜负/E 原因/F 法官/G 荣誉/H:I 积分/J:N 日志
  ops.push({
    shortcut: "+cols-resize",
    input: { sheet_id: sheetId, widths: JSON.stringify({ A: 200, B: 150, C: 170, D: 100, E: 70, F: 90, G: 190, "H:I": 220, "J:N": 600 }) },
  })
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: "1:1", height: 30 } })
  ops.push({ shortcut: "+dim-freeze", input: { sheet_id: sheetId, dimension: "row", count: 1 } })
  return ops
}

/** 单局数据行 ops：合并 + 网格边框 + 积分/日志换行 + 行高 auto（日志多行自动撑高） */
export function buildGameRowOps(sheetId: string, row: number): { shortcut: string; input: Record<string, unknown> }[] {
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  for (const range of rowMerges(row)) {
    ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
  }
  // 全行浅灰上下边框 + 字号 11 居中
  ops.push({
    shortcut: "+cells-set-style",
    input: {
      sheet_id: sheetId,
      range: `A${row}:N${row}`,
      font_size: 11,
      vertical_alignment: "middle",
      border_styles: JSON.stringify({
        top: { style: "solid", color: "#e5e7eb", weight: "thin" },
        bottom: { style: "solid", color: "#e5e7eb", weight: "thin" },
      }),
    },
  })
  // 积分/日志列顶端对齐 + 自动换行
  ops.push({
    shortcut: "+cells-set-style",
    input: { sheet_id: sheetId, range: `H${row}:N${row}`, vertical_alignment: "top", word_wrap: "auto-wrap" },
  })
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `${row}:${row}`, type: "auto" } })
  return ops
}