/**
 * 「每月复盘记录」表格构建器（纯函数，Node 14 兼容）
 * 与本地桥接 server/recordBlock.ts 保持逻辑一致，改动需两边同步。
 *
 * 布局 F（5 列 A..E，默认）：
 *   每局 = 一行一个合并块（A:E），左对齐；内容按顺序逐行：
 *   局次(title) → 时间/板子/胜负/原因/法官/荣誉 → 玩家积分(一人一行) → 对局日志(逐条)
 *   行高按实际行数计算撑高
 * 首行为固定表头（深蓝底白字加粗 + 冻结首行）；数据行积分/日志列自动换行、行高 auto。
 */
"use strict"

/** 分数展示：保留 1 位小数，正数带 + 号 */
function fmtScore(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`
}

const LAYOUTS = {
  F: {
    name: "F",
    cols: 5,
    slots: { block: 0 },
    labels: { block: "对局记录" },
    widths: { A: 250, B: 250, C: 250, D: 250, E: 250 },
    headerStyle: "A1:E1",
    mergesFor: (row) => [`A${row}:E${row}`],
    wrapCols: "A:E",
  },
  G: {
    name: "G",
    cols: 5,
    slots: { title: 0, body: 0 },
    labels: { title: "标题", body: "内容" },
    widths: { A: 250, B: 250, C: 250, D: 250, E: 250 },
    headerStyle: "A1:E1",
    mergesFor: (row) => [`A${row}:E${row}`],
    wrapCols: "A:E",
  },
}

const DEFAULT_LAYOUT = "G"

function layoutFor(name) {
  return LAYOUTS[name] || LAYOUTS[DEFAULT_LAYOUT]
}

/** 月份 key：YYYY-MM（空/解析失败返回 ""） */
function monthKeyOf(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** 月度复盘 tab 标题：YYYY-MM复盘 */
function monthTabTitle(date) {
  const m = monthKeyOf(date)
  return m ? `${m}复盘` : "未知月复盘"
}

/** 表头行（合并格值落在起始格） */
function headerRow(layoutName) {
  const L = layoutFor(layoutName)
  const row = new Array(L.cols).fill("")
  for (const [k, v] of Object.entries(L.labels)) row[L.slots[k]] = v
  return row
}

/** 单局数据行（积分/日志值落在起始格） */
function gameRow(payload, layoutName) {
  payload = payload || {}
  const L = layoutFor(layoutName)
  const row = new Array(L.cols).fill("")
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

/** 单局双行数据（标题行+内容行） */
function gameRows(payload, layoutName) {
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
  const titleRow = new Array(L.cols).fill("")
  titleRow[s.title] = titleText

  // 内容行：板子/胜负/原因/法官/荣誉 → 玩家积分 → 对局日志
  const block = []
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
  const bodyRow = new Array(L.cols).fill("")
  bodyRow[s.body] = block.join("\n")
  return [titleRow, bodyRow]
}

/** 表头行合并范围（A1 绝对地址，行号 1 起） */
function headerMerges(layoutName) {
  return layoutFor(layoutName).mergesFor(1)
}

/** 数据行合并范围（A1 绝对地址） */
function rowMerges(row, layoutName) {
  return layoutFor(layoutName).mergesFor(row)
}

/** CSV 单元格转义（RFC 4180：整格引号包裹、内部引号翻倍） */
function csvCell(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

/** 单行 → CSV 文本 */
function rowToCsv(row) {
  return row.map(csvCell).join(",")
}

module.exports = { LAYOUTS, DEFAULT_LAYOUT, layoutFor, monthKeyOf, monthTabTitle, fmtScore, headerRow, gameRow, gameRows, headerMerges, rowMerges, csvCell, rowToCsv }