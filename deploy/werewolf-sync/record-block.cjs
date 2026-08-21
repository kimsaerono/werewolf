/**
 * 「每局复盘记录」卡片区块构建器（纯函数，Node 14 兼容）
 * 与本地桥接 server/recordBlock.ts 保持逻辑一致，改动需两边同步。
 *
 * 每局一个卡片区块（列 A..N，共 14 列）：
 *   行R    │ A: 局次(gameId) │ B:N 合并: 🎮 板子 ｜ 胜负（原因）｜ 法官：xx   ← 深蓝底白字加粗
 *   行R+1  │                 │ B 列: ⏰ 时间：… ｜ 🏆 MVP：… ｜ SVP：… ｜ 背锅侠：…（中灰）
 *   行R+2  │                 │ B 列: 积分：1.赵妍(女巫) -0.5　2.武战峰(狼人) +3.5 …（溢出显示）
 *   行R+3~ │                 │ B 列逐行: 1.日志… / 2.日志…（浅灰小字）
 *   行末   │ 空行分隔（与下一局卡片隔开）
 */
"use strict"

/** 复盘表总列数（A..N） */
const RECORD_COLS = 14

/** 分数展示：保留 1 位小数，正数带 + 号 */
function fmtScore(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`
}

/**
 * 构建单局复盘卡片区块；startRow 为块首行的表格绝对行号（1 起）。
 * payload 为前端 /api/sync 请求体（老前端缺字段时兜底默认值）。
 */
function buildRecordBlock(payload, startRow) {
  payload = payload || {}
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

module.exports = { RECORD_COLS, fmtScore, buildRecordBlock }