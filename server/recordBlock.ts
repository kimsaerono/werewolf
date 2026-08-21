/** 「每局复盘记录」卡片区块构建器（纯函数，供本地桥接与测试共用）
 *
 * 每局一个卡片区块（列 A..N，共 14 列）：
 *   行R    │ A: 局次(gameId) │ B:N 合并: 🎮 板子 ｜ 胜负（原因）｜ 法官：xx   ← 深蓝底白字加粗
 *   行R+1  │                 │ B:N 合并: ⏰ 时间：… ｜ 🏆 MVP：… ｜ SVP：… ｜ 背锅侠：…
 *   行R+2  │                 │ B:N 合并: 积分：1.赵妍(女巫) -0.5　2.武战峰(狼人) +3.5 …
 *   行R+3~ │                 │ B 列逐行: 1.日志… / 2.日志…（灰字）
 *   行末   │ 空行分隔（与下一局卡片隔开）
 */
import type { SyncPayload } from "../src/api/feishuSync"

/** 复盘表总列数（A..N） */
export const RECORD_COLS = 14

export interface RecordBlock {
  /** 每行 [A, B] 两列的值，从块首行开始（末行为空行分隔） */
  rows: string[][]
  /** 需要合并的 B:N 区域（绝对行号 A1 表示法） */
  mergeRanges: string[]
  /** 标题行绝对行号 */
  titleRow: number
  /** 日志区起止绝对行号（无日志时 start > end） */
  logStartRow: number
  logEndRow: number
}

/** 分数展示：保留 1 位小数，正数带 + 号 */
function fmtScore(n: number): string {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`
}

/** 构建单局复盘卡片区块；startRow 为块首行的表格绝对行号（1 起） */
export function buildRecordBlock(payload: SyncPayload, startRow: number): RecordBlock {
  const board = payload.boardFinal || payload.board || "-"
  const title = `🎮 ${board}板 ｜ ${payload.winner || "-"}${payload.reason ? `（${payload.reason}）` : ""} ｜ 法官：${payload.judge?.name || "-"}`
  const infoParts = [`⏰ 时间：${payload.date}`]
  const honors = [payload.mvp ? `🏆 MVP：${payload.mvp}` : "", payload.svp ? `SVP：${payload.svp}` : "", payload.beiguo ? `背锅侠：${payload.beiguo}` : ""].filter(Boolean)
  if (honors.length) infoParts.push(honors.join(" ｜ "))
  const scoreLine =
    (payload.players || []).length
      ? `积分：` +
        (payload.players || [])
          .map((p) => `${p.no}.${p.name}(${p.role}) ${fmtScore(p.base + p.skill + p.vote)}`)
          .join("　")
      : ""
  const lines = payload.logLines || []

  const rows: string[][] = [
    [payload.gameId, title],
    ["", infoParts.join(" ｜ ")],
    ...(scoreLine ? [["", scoreLine] as [string, string]] : []),
    ...lines.map((l, i) => ["", `${i + 1}. ${l}`]),
    ["", ""],
  ]
  // 仅标题行合并 B:N（其余行不合并，靠文字溢出到 C..N 空白列自然展示，避免裁剪）
  const logStart = startRow + (scoreLine ? 3 : 2)
  return {
    rows,
    mergeRanges: [`B${startRow}:N${startRow}`],
    titleRow: startRow,
    logStartRow: logStart,
    logEndRow: logStart - 1 + lines.length,
  }
}

/** CSV 单元格转义（RFC 4180：整格引号包裹、内部引号翻倍） */
function csvCell(v: string): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

/** 区块 → CSV 文本（供 +csv-put --csv 使用） */
export function blockToCsv(block: RecordBlock): string {
  return block.rows.map((r) => r.map(csvCell).join(",")).join("\n")
}

/** 区块 → +batch-update 子操作列表（合并单元格 + 卡片样式 + 标题行高），原子提交 */
export function buildRecordOps(block: RecordBlock, sheetId: string): { shortcut: string; input: Record<string, unknown> }[] {
  const ops: { shortcut: string; input: Record<string, unknown> }[] = []
  // 仅标题行合并 B:N
  ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range: block.mergeRanges[0] } })
  // 标题行：深蓝底白字加粗（整行 A:N 拉通色条）+ 底边框
  ops.push({
    shortcut: "+cells-set-style",
    input: {
      sheet_id: sheetId,
      range: `A${block.titleRow}:N${block.titleRow}`,
      background_color: "#1668dc",
      font_color: "#ffffff",
      font_weight: "bold",
      font_size: 11,
      vertical_alignment: "middle",
      border_type: "BOTTOM_BORDER",
      border_color: "#0d4a9e",
    },
  })
  // 信息行 + 积分行：中灰 #6b7280、顶端对齐、自动换行（B 列溢出显示到 C..N）
  ops.push({
    shortcut: "+cells-set-style",
    input: {
      sheet_id: sheetId,
      range: `B${block.titleRow + 1}:B${block.logStartRow - 1}`,
      font_color: "#6b7280",
      vertical_alignment: "top",
      word_wrap: "auto-wrap",
    },
  })
  // 日志区：浅灰小号
  if (block.logEndRow >= block.logStartRow) {
    ops.push({
      shortcut: "+cells-set-style",
      input: {
        sheet_id: sheetId,
        range: `B${block.logStartRow}:B${block.logEndRow}`,
        font_color: "#8a8f99",
        font_size: 10,
        vertical_alignment: "top",
        word_wrap: "auto-wrap",
      },
    })
  }
  // 行高：标题 30、内容行 20、分隔行 10
  const sepRow = block.titleRow + block.rows.length - 1
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `${block.titleRow}:${block.titleRow}`, height: 30 } })
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `B${block.titleRow + 1}:B${sepRow - 1}`, height: 20 } })
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `${sepRow}:${sepRow}`, height: 10 } })
  return ops
}
