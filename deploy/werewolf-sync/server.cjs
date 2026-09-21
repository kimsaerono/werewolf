#!/usr/bin/env node
/**
 * 狼人杀 → 飞书表格 同步桥接（部署到公司内网服务器）
 * - 纯 Node 实现（兼容 Node 14），无外部依赖，直接用 node 运行
 * - 用飞书 OpenAPI（appId/appSecret 换 tenant_access_token）读写表格
 * - 前端 H5 通过 nginx 反代 /werewolf-sync 访问本服务
 *
 * 复盘：每个游戏月自动新建子表 tab（如「2026-09复盘」），每局一行 14 列表格（表头深蓝+冻结）。
 * 赛季：按自然季度，新季度首局同步时把上季度排名前 3 存入「历赛季前三」tab，并清零排名表开新赛季。
 *
 * 环境变量：
 *   APP_ID            飞书应用 App ID
 *   APP_SECRET        飞书应用 App Secret
 *   SPREADSHEET_TOKEN 飞书表格 token
 *   RANK_SHEET_ID     「积分统计排名」sheet_id
 *   RECORD_SHEET_ID   旧「每局复盘记录」sheet_id（仅用于 gameId 幂等去重）
 *   ACCESS_PASSWORD   同步口令（前端带 x-access-password 头）
 *   PORT              监听端口（默认 3460）
 * 启动：PORT=3460 APP_ID=.. APP_SECRET=.. node server.js
 */
"use strict"

const http = require("http")
const fs = require("fs")
const path = require("path")
const { layoutFor, headerRow, gameRow, gameRows, monthTabTitle, headerMerges, rowMerges } = require("./record-block.cjs")
const {
  quarterKeyOf,
  quarterLater,
  readConfigSeason,
  archiveRowFor,
  rankResetRows,
  archiveHeaderRow,
  CONFIG_SEASON_CELL,
  CONFIG_SEASON_LABEL,
} = require("./season-archive.cjs")

// 自动加载同目录 .env（KEY=VALUE 每行一行，忽略 # 注释）
const envFile = path.join(__dirname, ".env")
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq > 0) {
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim()
      if (k && process.env[k] === undefined) process.env[k] = v
    }
  }
}

const PORT = Number(process.env.PORT || 3460)
const ENV = {
  APP_ID: process.env.APP_ID || "",
  APP_SECRET: process.env.APP_SECRET || "",
  SPREADSHEET_TOKEN: process.env.SPREADSHEET_TOKEN || "",
  RANK_SHEET_ID: process.env.RANK_SHEET_ID || "",
  RECORD_SHEET_ID: process.env.RECORD_SHEET_ID || "",
  ACCESS_PASSWORD: process.env.ACCESS_PASSWORD || "",
}
const SEASONS_TAB_TITLE = "历赛季前三"

// 月度复盘布局（F=整局一合并块左对齐/默认），可用 LAYOUT_MODE 覆盖
const LAYOUT = String(process.env.LAYOUT_MODE || "F").toUpperCase()

// ===== 飞书 tenant_access_token 缓存 =====
let tokenCache = { token: "", expireAt: 0 }

async function getTenantToken() {
  const now = Date.now()
  if (tokenCache.token && now < tokenCache.expireAt) return tokenCache.token
  const res = await fetchJson("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: ENV.APP_ID, app_secret: ENV.APP_SECRET }),
  })
  if (!res.tenant_access_token) throw new Error("获取飞书 token 失败: " + (res.code || "") + " " + (res.msg || ""))
  tokenCache = { token: res.tenant_access_token, expireAt: now + ((res.expire || 7200) - 300) * 1000 }
  return res.tenant_access_token
}

/** 通用 fetch + JSON（兼容 Node 14） */
const https = require("https")
const httpMod = require("http")

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const mod = u.protocol === "https:" ? https : httpMod
    const req = mod.request(
      u,
      {
        method: opts.method || "GET",
        headers: opts.headers || {},
      },
      (res) => {
        let data = ""
        res.on("data", (c) => (data += c))
        res.on("end", () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve({ raw: data })
          }
        })
      },
    )
    req.on("error", reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

function checkAuth(req) {
  return req.headers["x-access-password"] === ENV.ACCESS_PASSWORD
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

// ===== 通用表格读写 =====
async function readValues(token, sheetId, range) {
  const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values/${sheetId}!${range}`
  const rr = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } })
  if (rr.code && rr.code !== 0) throw new Error("读取失败: " + rr.code + " " + (rr.msg || ""))
  return (rr.data && rr.data.valueRange && rr.data.valueRange.values) || []
}

/** 数字 → 列字母（1 起，如 27 → AA） */
function colToLetters(n) {
  let s = ""
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

/** 起始格 + 数据 → 显式区间（如 A1 + 14 列 → A1:N1）。飞书 values 批量接口不接受裸起始格（会 90202 wrong range）；列宽取所有行最大值 */
function rangeFor(startCell, values) {
  const m = String(startCell).match(/^([A-Z]+)(\d+)$/)
  const rows = Array.isArray(values) ? values.length : 0
  if (!m || !rows) return String(startCell)
  let cols = 1
  for (const r of values) {
    if (r && Array.isArray(r) && r.length > cols) cols = r.length
  }
  let ci = 0
  for (const ch of m[1]) ci = ci * 26 + (ch.charCodeAt(0) - 64)
  const lastCol = colToLetters(ci + cols - 1)
  const lastRow = parseInt(m[2], 10) + rows - 1
  return `${m[1]}${parseInt(m[2], 10)}:${lastCol}${lastRow}`
}

async function writeValues(token, sheetId, startCell, values) {
  const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`
  const range = `${sheetId}!${rangeFor(startCell, values)}`
  const res = await fetchJson(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ valueRanges: [{ range, values }] }),
  })
  if (res.code && res.code !== 0) throw new Error("写值失败: " + res.code + " " + (res.msg || ""))
}

/** 找最后一行有数据的行号（1 起），空表返回 1 */
function lastDataRow(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v && v.some((x) => x !== null && x !== undefined && String(x).trim() !== "")) return i + 1
  }
  return 1
}

// ===== 子表（tab）管理 =====
async function listSheets(token) {
  const url = `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${ENV.SPREADSHEET_TOKEN}/sheets/query`
  const res = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.code && res.code !== 0) throw new Error("读工作簿失败: " + res.code + " " + (res.msg || ""))
  const map = new Map()
  for (const s of (res.data && res.data.sheets) || []) {
    if (s && s.sheet_id && s.title) map.set(s.title, s.sheet_id)
  }
  return map
}

async function addSheet(token, title) {
  const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/sheets_batch_update`
  const res = await fetchJson(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  })
  if (res.code && res.code !== 0) throw new Error("建 tab 失败: " + res.code + " " + (res.msg || ""))
  const sid =
    res.data &&
    res.data.replies &&
    res.data.replies[0] &&
    res.data.replies[0].addSheet &&
    res.data.replies[0].addSheet.properties &&
    res.data.replies[0].addSheet.properties.sheetId
  if (!sid) throw new Error("建 tab 响应无 sheetId")
  return sid
}

/** 确保标题 tab 存在；不存在则创建并初始化，返回 { sheetId, created }。飞书对删表/建表的快照最终一致，90210（标题已存在于快照）时轮询重列并复用，避免建表偶发失败 */
async function ensureSheet(token, title, initFn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const map = await listSheets(token)
    if (map.has(title)) return { sheetId: map.get(title), created: false }
    let sheetId
    try {
      sheetId = await addSheet(token, title)
    } catch (e) {
      if (attempt < 5 && String((e && e.message) || "").includes("90210")) {
        await new Promise((r) => setTimeout(r, 15000))
        continue
      }
      throw e
    }
    await initFn(token, sheetId, title)
    return { sheetId, created: true }
  }
  const map = await listSheets(token)
  const sheetId = map.get(title)
  if (sheetId) {
    await initFn(token, sheetId, title)
    return { sheetId, created: true }
  }
  throw new Error("建 tab 始终失败: 90210 快照未收敛")
}

/** 合并单元格（失败只告警，不阻断数据落盘） */
async function safeStyle(fn) {
  try {
    await fn()
  } catch (e) {
    console.error("[warn] 复盘样式失败（数据不受影响）:", (e && e.message) || e)
  }
}

/** 月度复盘 tab 初始化：表头 + 合并 + 表头样式 + 列宽 + 行高 + 冻结 */
async function initMonthTab(token, sheetId, title) {
  await safeStyle(async () => {
    const L = layoutFor(LAYOUT)
    // 布局 G：无表头行，数据从第 1 行开始；其他布局保留表头
    if (LAYOUT !== "G") {
      // 表头标题按时间显示，如「2026年09月 对局记录」
      const m = String(title || "").match(/^(\d{4})-(\d{2})复盘$/)
      const headerCell = m ? `${m[1]}年${String(m[2])}月 对局记录` : (title ? `${title} 对局记录` : headerRow(LAYOUT)[0])
      const headerVals = headerRow(LAYOUT)
      headerVals[0] = headerCell
      await writeValues(token, sheetId, "A1", [headerVals])
      const mergeUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/merge_cells`
      for (const range of headerMerges(LAYOUT)) {
        const mRes = await fetchJson(mergeUrl, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ range: `${sheetId}!${range}`, mergeType: "MERGE_ALL" }),
        })
        if (mRes.code && mRes.code !== 0) throw new Error("合并失败: " + mRes.code + " " + (mRes.msg || ""))
      }
      const sRes = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            data: [{ ranges: [`${sheetId}!${L.headerStyle}`], style: { backColor: "#1668dc", foreColor: "#ffffff", font: { bold: true, size: "11pt/1.5" }, hAlign: 2, vAlign: 1 } }],
          }),
        },
      )
      if (sRes.code && sRes.code !== 0) throw new Error("表头样式失败: " + sRes.code + " " + (sRes.msg || ""))
      // 表头行高 30px
      const hRes = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/dimension_range`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            dimension: { sheetId, majorDimension: "ROWS", startIndex: 1, endIndex: 2 },
            dimensionProperties: { fixedSize: 30 },
          }),
        },
      )
      if (hRes.code && hRes.code !== 0) throw new Error("表头行高失败: " + hRes.code + " " + (hRes.msg || ""))
      // 冻结表头首行
      await fetchJson(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/frozen_rows`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ sheetId, frozenRowCount: 1 }),
      })
    }
    // 列宽（px，逐列）——所有布局都需要
    for (const [letters, px] of Object.entries(L.widths)) {
      const start = colToIndex(letters)
      const dRes = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/dimension_range`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            dimension: { sheetId, majorDimension: "COLUMNS", startIndex: start, endIndex: start + 1 },
            dimensionProperties: { fixedSize: px },
          }),
        },
      )
      if (dRes.code && dRes.code !== 0) throw new Error("列宽失败: " + dRes.code + " " + (dRes.msg || ""))
    }
  })
}

/** 列名 → 1 起始索引（飞书维度索引 >=1，如 A=1） */
function colToIndex(letters) {
  let n = 0
  for (const ch of String(letters).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** 「历赛季前三」tab 初始化：表头 + 样式（配置存 Z1，不占 A/B） */
async function initSeasonsTab(token, sheetId) {
  await safeStyle(async () => {
    // 表头 A1:B1 = "赛季"/"前三名"；配置存 Z1（远端）
    await writeValues(token, sheetId, "A1", [["赛季", "前三名"]])
    const sRes = await fetchJson(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
      {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          data: [{ ranges: [`${sheetId}!A1:B1`], style: { backColor: "#1668dc", foreColor: "#ffffff", font: { bold: true, size: "11pt/1.5" }, hAlign: 2, vAlign: 1 } }],
        }),
      },
    )
    if (sRes.code && sRes.code !== 0) throw new Error("表头样式失败: " + sRes.code + " " + (sRes.msg || ""))
    for (const [key, px] of Object.entries({ A: 180, B: 450 })) {
      const start = colToIndex(key)
      await fetchJson(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/dimension_range`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          dimension: { sheetId, majorDimension: "COLUMNS", startIndex: start, endIndex: start + 1 },
          dimensionProperties: { fixedSize: px },
        }),
      })
    }
  })
}

// ===== 幂等去重 =====
async function hasGameId(token, gameId, monthTabId) {
  if (!gameId) return false
  if (monthTabId) {
    const a = await readValues(token, monthTabId, "A1:A5000")
    if (a.some((v) => v && String(v[0] || "").trim() === String(gameId).trim())) return true
  }
  if (ENV.RECORD_SHEET_ID) {
    const b = await readValues(token, ENV.RECORD_SHEET_ID, "A1:A5000")
    if (b.some((v) => v && String(v[0] || "").trim() === String(gameId).trim())) return true
  }
  return false
}

// ===== 季度存档 + 排名清零 =====
async function archiveSeasonIfChanged(token, date) {
  const seasonKey = quarterKeyOf(date)
  if (!seasonKey) return
  const seasons = await ensureSheet(token, SEASONS_TAB_TITLE, initSeasonsTab)
  const cfgRows = await readValues(token, seasons.sheetId, "A1:Z100")
  const cur = readConfigSeason(cfgRows)
  if (cur) {
    if (!quarterLater(seasonKey, cur)) return
    // 上季度（cur）前三 →「历赛季前三」追加一行
    const rankRows = await readValues(token, ENV.RANK_SHEET_ID, "A1:K200")
    const archRow = archiveRowFor(rankRows.slice(1), cur, new Date().toLocaleString())
    const sNext = lastDataRow(cfgRows) + 1
    await writeValues(token, seasons.sheetId, `A${sNext}`, [archRow])
    // 排行榜清零：保留名单与表头，场次/胜/负/胜率/积分归零，排名重排
    await writeValues(token, ENV.RANK_SHEET_ID, "A1", rankResetRows(rankRows))
    // 更新当前赛季标记
    await writeValues(token, seasons.sheetId, CONFIG_SEASON_CELL, [[seasonKey]])
  } else {
    // 首跑：仅写当前赛季基线（不清零、不补存档）
    await writeValues(token, seasons.sheetId, CONFIG_SEASON_CELL, [[seasonKey]])
  }
}

// ===== 月度复盘追加 =====
const RECORD_READ_LIMIT = 5000

function wrapRangeFor(layout, row) {
  const [a, b] = String(layout.wrapCols).split(":")
  return `${a}${row}:${b}${row}`
}

async function decorateGameRow(token, sheetId, titleRow, bodyRow, layoutName) {
  const L = layoutFor(layoutName)
  await safeStyle(async () => {
    const mergeUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/merge_cells`
    // 标题行合并 + 样式（蓝底、居中）
    for (const range of rowMerges(titleRow, layoutName)) {
      const mRes = await fetchJson(mergeUrl, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ range: `${sheetId}!${range}`, mergeType: "MERGE_ALL" }),
      })
      if (mRes.code && mRes.code !== 0) throw new Error("合并失败: " + mRes.code + " " + (mRes.msg || ""))
    }
    const lastCol = colToLetters(L.cols)
    const sTitle = await fetchJson(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
      {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          data: [{ ranges: [`${sheetId}!A${titleRow}:${lastCol}${titleRow}`], style: { backColor: "#1668dc", foreColor: "#ffffff", font: { bold: true, size: "11pt/1.5" }, hAlign: 0, vAlign: 2, border: { bottom: { color: "#1668dc", style: "SOLID" } } } }],
        }),
      },
    )
    if (sTitle.code && sTitle.code !== 0) throw new Error("标题行样式失败: " + sTitle.code + " " + (sTitle.msg || ""))
    // 内容行合并 + 样式（左对齐、边框、自动换行）
    if (bodyRow) {
      for (const range of rowMerges(bodyRow, layoutName)) {
        const mRes = await fetchJson(mergeUrl, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ range: `${sheetId}!${range}`, mergeType: "MERGE_ALL" }),
        })
        if (mRes.code && mRes.code !== 0) throw new Error("合并失败: " + mRes.code + " " + (mRes.msg || ""))
      }
      const sBody = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            data: [{ ranges: [`${sheetId}!A${bodyRow}:${lastCol}${bodyRow}`], style: { font: { size: "11pt/1.5" }, hAlign: 0, vAlign: 0, border: { borderAll: { color: "#e5e7eb", style: "SOLID" } } } }],
          }),
        },
      )
      if (sBody.code && sBody.code !== 0) throw new Error("内容行样式失败: " + sBody.code + " " + (sBody.msg || ""))
      // 内容行自动换行
      const wRes = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            data: [{ ranges: [`${sheetId}!${wrapRangeFor(L, bodyRow)}`], style: { vAlign: 0, textWrap: true } }],
          }),
        },
      )
      if (wRes.code && wRes.code !== 0) throw new Error("换行样式失败: " + wRes.code + " " + (wRes.msg || ""))
      // 行高：标题行固定 36px（左对齐+底部留白），内容行按内容估算（最低 400px）
      await Promise.all([
        fetchJson(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/dimension_range`, {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            dimension: { sheetId, majorDimension: "ROWS", startIndex: titleRow, endIndex: titleRow + 1 },
            dimensionProperties: { fixedSize: 36 },
          }),
        }),
        autoSizeRowEstimate(token, sheetId, bodyRow, false),
      ])
    } else {
      // 兼容旧布局：单行
      const sRes = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            data: [{ ranges: [`${sheetId}!A${titleRow}:${lastCol}${titleRow}`], style: { font: { size: "11pt/1.5" }, hAlign: 0, vAlign: 0, border: { borderAll: { color: "#e5e7eb", style: "SOLID" } } } }],
          }),
        },
      )
      if (sRes.code && sRes.code !== 0) throw new Error("行样式失败: " + sRes.code + " " + (sRes.msg || ""))
      const wRes = await fetchJson(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            data: [{ ranges: [`${sheetId}!${wrapRangeFor(L, titleRow)}`], style: { vAlign: 0, textWrap: true } }],
          }),
        },
      )
      if (wRes.code && wRes.code !== 0) throw new Error("换行样式失败: " + wRes.code + " " + (wRes.msg || ""))
      await autoSizeRowEstimate(token, sheetId, titleRow, false)
    }
  })
}

/** 某列（1 起始）在布局中的展示宽度：落在合并块里则取合并总宽，否则取本列宽 */
function contentWidthFor(L, idx) {
  const n = idx + 1
  for (const range of L.mergesFor(1)) {
    const [a, b] = String(range).replace(/\d+/g, "").split(":")
    const s = colToIndex(a)
    const e = colToIndex(b)
    if (n >= s && n <= e) {
      let w = 0
      for (let c = s; c <= e; c++) w += L.widths[colToLetters(c)] || 0
      return w
    }
  }
  return L.widths[colToLetters(idx + 1)] || 0
}

// 行高：按内容行数估算像素高度（合并块按总宽估算换行数）
async function autoSizeRowEstimate(token, sheetId, row, isTitleRow = false) {
  const L = layoutFor(LAYOUT)
  const rows = await readValues(token, sheetId, `A${row}:${colToLetters(L.cols)}${row}`)
  const data = rows[0] || []
  let lines = 1
  for (let i = 0; i < data.length; i++) {
    const cell = data[i] == null ? "" : String(data[i])
    if (!cell) continue
    const colPx = contentWidthFor(L, i)
    const charsPerLine = Math.max(4, Math.floor((colPx * 1.15) / 16)) // 11pt 中文约 16px/字，含间隙
    const cellLines = cell.split("\n").reduce((n, seg) => n + Math.max(1, Math.ceil((seg.length || 1) / charsPerLine)), 0)
    if (cellLines > lines) lines = cellLines
  }
  // 布局 G 内容行最低 400px，标题行固定 30px
  const minPx = LAYOUT === "G" && !isTitleRow ? 400 : 36
  const px = Math.max(minPx, Math.round(lines * 22 + 12))
  await fetchJson(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/dimension_range`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({
      dimension: { sheetId, majorDimension: "ROWS", startIndex: row, endIndex: row + 1 },
      dimensionProperties: { fixedSize: px },
    }),
  })
}

async function appendMonthGame(token, body) {
  const title = monthTabTitle(body.date)
  const L = layoutFor(LAYOUT)
  const { sheetId } = await ensureSheet(token, title, initMonthTab)
  const rows = await readValues(token, sheetId, `A1:${colToLetters(L.cols)}${RECORD_READ_LIMIT}`)
  let nextRow = lastDataRow(rows) + 1
  // 布局 G 无表头：空表时从第 1 行开始
  if (LAYOUT === "G" && nextRow === 2) nextRow = 1
  if (nextRow > RECORD_READ_LIMIT) throw new Error(`复盘表已写满（${RECORD_READ_LIMIT} 行），请扩容或归档后重试`)
  // 写入：布局 G 双行，其他布局单行
  let titleRow, bodyRow
  if (LAYOUT === "G") {
    const [tRow, bRow] = gameRows(body, LAYOUT)
    titleRow = nextRow
    bodyRow = nextRow + 1
    await writeValues(token, sheetId, `A${titleRow}`, [tRow, bRow])
  } else {
    titleRow = nextRow
    await writeValues(token, sheetId, `A${titleRow}`, [gameRow(body, LAYOUT)])
  }
  await decorateGameRow(token, sheetId, titleRow, bodyRow, LAYOUT)
}

// ===== 更新积分排名 =====
async function updateRanking(token, rows) {
  const readUrl =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values/${ENV.RANK_SHEET_ID}!A2:K200`
  const readRes = await fetchJson(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (readRes.code && readRes.code !== 0) throw new Error("读排名失败: " + readRes.code)
  const values = (readRes.data && readRes.data.valueRange && readRes.data.valueRange.values) || []

  const nameToRow = new Map()
  for (let i = 0; i < values.length; i++) {
    const nick = String(values[i] && values[i][1] ? values[i][1] : "").trim()
    if (nick) nameToRow.set(nick, i + 2)
  }

  const agg = new Map()
  for (const r of rows) {
    if (!r.name) continue
    const cur = agg.get(r.name) || { games: 0, wins: 0, score: 0 }
    cur.games++
    if (r.win) cur.wins++
    cur.score += r.score
    agg.set(r.name, cur)
  }

  const updates = []
  const appends = []
  let nextRank = nameToRow.size + 1
  for (const [name, a] of agg) {
    const row = nameToRow.get(name)
    if (row) {
      const prev = values[row - 2] || []
      const g = Number(prev[2] || 0) + a.games
      const w = Number(prev[3] || 0) + a.wins
      const l = Number(prev[4] || 0) + (a.games - a.wins)
      const s = Number(prev[6] || 0) + a.score
      const rate = g ? ((w / g) * 100).toFixed(2) + "%" : "0.00%"
      updates.push({ row, vals: [g, w, l, rate, s] })
    } else {
      const rate = a.games ? ((a.wins / a.games) * 100).toFixed(2) + "%" : "0.00%"
      appends.push([nextRank, name, a.games, a.wins, a.games - a.wins, rate, a.score, 0, 0, "-", "-"])
      nextRank++
    }
  }

  if (updates.length) {
    const res = await fetchJson(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ valueRanges: updates.map((u) => ({ range: `${ENV.RANK_SHEET_ID}!C${u.row}:G${u.row}`, values: [u.vals] })) }),
      },
    )
    if (res.code && res.code !== 0) throw new Error("更新排名失败: " + res.code + " " + res.msg)
  }

  if (appends.length) {
    let firstEmpty = values.length + 2
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      const hasData = v && v.some((x) => x !== null && x !== undefined && String(x).trim() !== "")
      if (!hasData) {
        firstEmpty = i + 2
        break
      }
    }
    const res = await fetchJson(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          valueRanges: appends.map((row, i) => ({
            range: `${ENV.RANK_SHEET_ID}!A${firstEmpty + i}:K${firstEmpty + i}`,
            values: [row],
          })),
        }),
      },
    )
    if (res.code && res.code !== 0) throw new Error("追加玩家失败: " + res.code + " " + res.msg)
  }
}

// ===== 法官计分 =====
async function addJudgeScore(token, judge) {
  if (!judge || !judge.name) return
  const score = Number(judge.score || 0)
  if (!score) return
  const readUrl =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values/${ENV.RANK_SHEET_ID}!A2:K200`
  const rr = await fetchJson(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (rr.code && rr.code !== 0) throw new Error("读排名失败: " + rr.code)
  const vals = (rr.data && rr.data.valueRange && rr.data.valueRange.values) || []
  const url =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`
  let row = null
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] && String(vals[i][1] || "").trim() === String(judge.name).trim()) {
      row = i + 2
      break
    }
  }
  if (row) {
    const prev = vals[row - 2] || []
    const s = Math.round((Number(prev[6] || 0) + score) * 10) / 10
    const res = await fetchJson(url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ valueRanges: [{ range: `${ENV.RANK_SHEET_ID}!G${row}:G${row}`, values: [[s]] }] }),
    })
    if (res.code && res.code !== 0) throw new Error("法官计分失败: " + res.code + " " + res.msg)
  } else {
    let firstEmpty = vals.length + 2
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i]
      const hasData = v && v.some((x) => x !== null && x !== undefined && String(x).trim() !== "")
      if (!hasData) {
        firstEmpty = i + 2
        break
      }
    }
    const res = await fetchJson(url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        valueRanges: [{ range: `${ENV.RANK_SHEET_ID}!A${firstEmpty}:K${firstEmpty}`, values: [[firstEmpty - 1, judge.name, 0, 0, 0, "0", score, 0, 0, "-", "-"]] }],
      }),
    })
    if (res.code && res.code !== 0) throw new Error("法官新增失败: " + res.code + " " + res.msg)
  }
}

// ===== 按总积分降序重排排名表 =====
async function reSortRanking(token) {
  const readUrl =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values/${ENV.RANK_SHEET_ID}!A2:K200`
  const rr = await fetchJson(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (rr.code && rr.code !== 0) throw new Error("读排名失败: " + rr.code)
  const vals = (rr.data && rr.data.valueRange && rr.data.valueRange.values) || []
  const rows = vals
    .map((v) => v.slice(0, 11))
    .filter((v) => v.some((x) => x !== null && x !== undefined && String(x).trim() !== ""))
  rows.sort((a, b) => Number(b[6] || 0) - Number(a[6] || 0) || String(a[1] || "").localeCompare(String(b[1] || ""), "zh"))
  rows.forEach((r, i) => {
    r[0] = i + 1
  })
  const out = rows.slice()
  while (out.length < 199) out.push(["", "", "", "", "", "", "", "", "", "", ""])
  const url =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`
  const res = await fetchJson(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ valueRanges: [{ range: `${ENV.RANK_SHEET_ID}!A2:K200`, values: out }] }),
  })
  if (res.code && res.code !== 0) throw new Error("重排排名失败: " + res.code + " " + res.msg)
  const styleRes = await fetchJson(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/styles_batch_update`,
    {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ data: [{ ranges: [`${ENV.RANK_SHEET_ID}!A2:K200`], style: { border: { borderAll: { color: "#2b3145", style: "SOLID" } } } }] }),
    },
  )
  if (styleRes.code && styleRes.code !== 0) throw new Error("排名表边框失败: " + styleRes.code + " " + styleRes.msg)
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-access-password",
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (c) => (data += c))
    req.on("end", () => resolve(data))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-access-password",
    })
    res.end()
    return
  }

  try {
    if (path === "/api/health") {
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === "/api/sync-test" && req.method === "POST") {
      if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: "unauthorized" })
      sendJson(res, 200, { ok: true, test: true })
      return
    }
    if (path === "/api/sync" && req.method === "POST") {
      if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: "unauthorized" })
      const body = JSON.parse((await readBody(req)) || "{}")
      if (!body.players || !body.players.length) return sendJson(res, 400, { ok: false, error: "players 不能为空" })
      const token = await getTenantToken()

      // 幂等去重：该 gameId 已落在当月复盘 tab 或旧复盘 tab = 已同步，直接成功返回
      const sheets = await listSheets(token)
      const title = monthTabTitle(body.date)
      const monthTabId = sheets.get(title) || null
      if (await hasGameId(token, body.gameId, monthTabId)) {
        sendJson(res, 200, { ok: true })
        return
      }

      // 新季度首局：先留存上季前三 + 排名清零，再累计当季度
      await archiveSeasonIfChanged(token, body.date)

      // 排名 / 法官 / 重排
      await updateRanking(token, body.players.map((p) => ({ name: p.name, win: p.win, score: p.base + p.skill + p.vote })))
      await addJudgeScore(token, body.judge)
      await reSortRanking(token)

      // 复盘表写入放最后作为「提交点」：gameId 落盘 ⇒ 整局已累计完成
      await appendMonthGame(token, body)
      sendJson(res, 200, { ok: true })
      return
    }
    sendJson(res, 404, { ok: false, error: "not found" })
  } catch (e) {
    sendJson(res, 500, { ok: false, error: (e && e.message) || String(e) })
  }
})

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🛰️ 狼人杀飞书同步桥接已启动: http://0.0.0.0:${PORT}`)
    console.log(`   表格: ${ENV.SPREADSHEET_TOKEN}`)
  })
}

module.exports = {
  ENV,
  PORT,
  LAYOUT,
  getTenantToken,
  fetchJson,
  readValues,
  writeValues,
  addSheet,
  ensureSheet,
  initMonthTab,
  decorateGameRow,
  autoSizeRowEstimate,
}