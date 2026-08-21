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
    `积分：` +
    (payload.players || [])
      .map((p) => `${p.no}.${p.name}(${p.role}) ${fmtScore(p.base + p.skill + p.vote)}`)
      .join("　")
  const lines = payload.logLines || []

  const rows: string[][] = [
    [payload.gameId, title],
    ["", infoParts.join(" ｜ ")],
    ["", scoreLine],
    ...lines.map((l, i) => ["", `${i + 1}. ${l}`]),
    ["", ""],
  ]
  return {
    rows,
    mergeRanges: [`B${startRow}:N${startRow}`, `B${startRow + 1}:N${startRow + 1}`, `B${startRow + 2}:N${startRow + 2}`],
    titleRow: startRow,
    logStartRow: startRow + 3,
    logEndRow: startRow + 2 + lines.length,
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
  for (const range of block.mergeRanges) {
    ops.push({ shortcut: "+cells-merge", input: { sheet_id: sheetId, range } })
  }
  // 标题行：深蓝底白字加粗（整行 A:N 拉通色条）
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
    },
  })
  // 信息/积分行：自动换行、顶端对齐
  ops.push({
    shortcut: "+cells-set-style",
    input: {
      sheet_id: sheetId,
      range: `B${block.titleRow + 1}:B${block.titleRow + 2}`,
      word_wrap: "auto-wrap",
      vertical_alignment: "top",
    },
  })
  // 日志区：灰字小号
  if (block.logEndRow >= block.logStartRow) {
    ops.push({
      shortcut: "+cells-set-style",
      input: {
        sheet_id: sheetId,
        range: `B${block.logStartRow}:B${block.logEndRow}`,
        font_color: "#8a8f99",
        font_size: 10,
        word_wrap: "auto-wrap",
        vertical_alignment: "top",
      },
    })
  }
  // 标题行行高
  ops.push({ shortcut: "+rows-resize", input: { sheet_id: sheetId, range: `${block.titleRow}:${block.titleRow}`, height: 30 } })
  return ops
}
