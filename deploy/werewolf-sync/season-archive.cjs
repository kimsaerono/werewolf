/**
 * 「历赛季前三」存档与赛季清零构建器（纯函数，Node 14 兼容）
 * 与本地桥接 server/seasonArchive.ts 保持逻辑一致，改动需两边同步。
 *
 * 「历赛季前三」tab 布局（2 列 A..B，表头第 1 行）：
 *   A赛季 │ B前三名
 * 配置区：C1=固定标签"当前赛季"，C2=当前赛季 key（YYYY-Qn）。
 */
"use strict"

const { fmtScore } = require("./record-block.cjs")

/** 狼人杀 S 赛季命名库（按自然季度 Q3~Q2 循环） */
const SEASON_DISPLAY_MAP = {
  "2026-Q3": "S1 初见·月下",
  "2026-Q4": "S2 迷雾·深林",
  "2027-Q1": "S3 破晓·刀光",
  "2027-Q2": "S4 春风·真相",
  "2027-Q3": "S5 赤月·狼烟",
  "2027-Q4": "S6 幽梦·剧场",
  "2028-Q1": "S7 寒夜·守望",
  "2028-Q2": "S8 曙光·裁决",
  "2028-Q3": "S9 星河·誓约",
  "2028-Q4": "S10 终局·传说",
}

/** 季度 key：YYYY-Qn（空/解析失败返回 ""） */
function quarterKeyOf(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

/** 季度展示文案：优先查映射表，无则回退 YYYY年Qn */
function quarterLabel(key) {
  return SEASON_DISPLAY_MAP[key] || (() => {
    const m = String(key).match(/^(\d{4})-Q([1-4])$/)
    return m ? `${m[1]}年Q${m[2]}` : key || "-"
  })()
}

/** 季比较：a 是否晚于 b（YYYY-Qn） */
function quarterLater(a, b) {
  const ma = String(a).match(/^(\d{4})-Q([1-4])$/)
  const mb = String(b).match(/^(\d{4})-Q([1-4])$/)
  if (!ma || !mb) return false
  return Number(ma[1]) * 4 + Number(ma[2]) > Number(mb[1]) * 4 + Number(mb[2])
}

/** 「历赛季前三」表头行（2 列） */
function archiveHeaderRow() {
  return ["赛季", "前三名"]
}

/** 配置区：当前赛季 key 存 Z1（远端不干扰 A/B 列显示） */
const CONFIG_SEASON_CELL = "Z1"

/** 从「历赛季前三」读回的行数组中取当前赛季 key（rows[0] 为表头行，Z1 即 index 25） */
function readConfigSeason(rows) {
  rows = rows || []
  return String((rows[0] && rows[0][25]) || "").trim() || ""
}

/** 排名行（不含表头）→ 按总积分(G, index 6)降序取前三；返回 [{name, score}] */
function topThree(rows) {
  return (rows || [])
    .map((r) => ({ name: String((r && r[1]) || "").trim(), score: Number((r && r[6]) || 0) || 0 }))
    .filter((r) => r.name)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), "zh"))
    .slice(0, 3)
}

/** 构造「历赛季前三」存档行（2 列）：赛季 / 前三名（单元格内换行） */
function archiveRowFor(rows, quarterKey, archiveTime) {
  const t3 = topThree(rows)
  const medals = ["🏆", "🥈", "🥉"]
  const lines = t3.map((p, i) => `${medals[i]}${i + 1}.${p.name} ${fmtScore(p.score)}`).join("\n")
  return [quarterLabel(quarterKey), lines || "-"]
}

/** 赛季清零：保留表头行与 A 排名/B 昵称/H..K 原有值，C 场次 D 胜 E 负 F 胜率 G 积分 归零，数据行排名重排为 1..N
 *  入参为完整行数组（rows[0] 须为表头行，原样保留）。 */
function rankResetRows(rows) {
  const out = []
  const cell = (v) => String(v == null ? "" : v)
  let rank = 0
  ;(rows || []).forEach((r, i) => {
    if (i === 0) {
      out.push((rows[0] || []).map(cell))
      return
    }
    if (!String((r && r[1]) || "").trim()) return
    rank++
    out.push([String(rank), cell(r[1]), "0", "0", "0", "0%", "0", cell(r[7]), cell(r[8]), cell(r[9]), cell(r[10])])
  })
  return out
}

module.exports = { quarterKeyOf, quarterLabel, quarterLater, archiveHeaderRow, CONFIG_SEASON_CELL, readConfigSeason, topThree, archiveRowFor, rankResetRows, SEASON_DISPLAY_MAP }