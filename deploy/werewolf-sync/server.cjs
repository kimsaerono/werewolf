#!/usr/bin/env node
/**
 * 狼人杀 → 飞书表格 同步桥接（部署到公司内网服务器）
 * - 纯 Node 实现（兼容 Node 14），无外部依赖，直接用 node 运行
 * - 用飞书 OpenAPI（appId/appSecret 换 tenant_access_token）读写表格
 * - 前端 H5 通过 nginx 反代 /werewolf-sync 访问本服务
 *
 * 环境变量：
 *   APP_ID            飞书应用 App ID
 *   APP_SECRET        飞书应用 App Secret
 *   SPREADSHEET_TOKEN 飞书表格 token
 *   RANK_SHEET_ID     「积分统计排名」sheet_id
 *   RECORD_SHEET_ID   「每局复盘记录」sheet_id
 *   ACCESS_PASSWORD   同步口令（前端带 x-access-password 头）
 *   PORT              监听端口（默认 3460）
 * 启动：PORT=3460 APP_ID=.. APP_SECRET=.. node server.js
 */
"use strict"

const http = require("http")
const fs = require("fs")
const path = require("path")

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

/** 通用 fetch + JSON（兼容 Node 14：node14 有全局 fetch？无 → 用 http/https） */
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

// ===== 追加行到复盘表 =====
async function appendRecordRows(token, rows) {
  // 读复盘表找第一个空行
  const readUrl =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values/${ENV.RECORD_SHEET_ID}!A1:K300`
  const readRes = await fetchJson(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (readRes.code && readRes.code !== 0) throw new Error("读复盘失败: " + readRes.code)
  const existing = (readRes.data && readRes.data.valueRange && readRes.data.valueRange.values) || []
  let firstEmpty = existing.length + 1
  for (let i = 0; i < existing.length; i++) {
    const v = existing[i]
    const hasData = v && v.some((x) => x !== null && x !== undefined && String(x).trim() !== "")
    if (!hasData) {
      firstEmpty = i + 1
      break
    }
  }
  const url =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=USER_ENTERED`
  const res = await fetchJson(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      valueRanges: rows.map((row, i) => ({
        range: `${ENV.RECORD_SHEET_ID}!A${firstEmpty + i}:K${firstEmpty + i}`,
        values: [row],
      })),
    }),
  })
  if (res.code && res.code !== 0) throw new Error("写复盘失败: " + res.code + " " + res.msg)
}

// ===== 更新积分排名 =====
// 排名表列结构（真实表头）：A排名 B(空/真实姓名) C玩家昵称 D总场次 E胜场 F负场 G胜率 H总积分 I MVP J SVP K最佳身份
async function updateRanking(token, rows) {
  const readUrl =
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values/${ENV.RANK_SHEET_ID}!A2:K200`
  const readRes = await fetchJson(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (readRes.code && readRes.code !== 0) throw new Error("读排名失败: " + readRes.code)
  const values = (readRes.data && readRes.data.valueRange && readRes.data.valueRange.values) || []

  // 昵称(列C, index2) → 行号（表头占1，故行号=index+2）
  const nameToRow = new Map()
  for (let i = 0; i < values.length; i++) {
    const nick = String(values[i] && values[i][2] ? values[i][2] : "").trim()
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
      const g = Number(prev[3] || 0) + a.games
      const w = Number(prev[4] || 0) + a.wins
      const l = Number(prev[5] || 0) + (a.games - a.wins)
      const s = Number(prev[7] || 0) + a.score
      const rate = g ? ((w / g) * 100).toFixed(2) + "%" : "0.00%"
      // D总场次 E胜 F负 G胜率 H总积分
      updates.push({ row, vals: [g, w, l, rate, s] })
    } else {
      const rate = a.games ? ((a.wins / a.games) * 100).toFixed(2) + "%" : "0.00%"
      // A排名 C昵称 D场次 E胜 F负 G胜率 H积分
      appends.push([nextRank, null, name, a.games, a.wins, a.games - a.wins, rate, a.score, 0, 0, "-"])
      nextRank++
    }
  }

  if (updates.length) {
    const url =
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`
    const res = await fetchJson(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valueRanges: updates.map((u) => ({ range: `${ENV.RANK_SHEET_ID}!D${u.row}:H${u.row}`, values: [u.vals] })) }),
    })
    if (res.code && res.code !== 0) throw new Error("更新排名失败: " + res.code + " " + res.msg)
  }

  if (appends.length) {
    // 找第一个空行（从最后一行往下找，或直接数据行末尾）
    let firstEmpty = values.length + 2 // 默认：读到200行的下一行
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      const hasData = v && v.some((x) => x !== null && x !== undefined && String(x).trim() !== "")
      if (!hasData) {
        firstEmpty = i + 2
        break
      }
    }
    const url =
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${ENV.SPREADSHEET_TOKEN}/values_batch_update?valueInputOption=RAW`
    const res = await fetchJson(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        valueRanges: appends.map((row, i) => ({
          range: `${ENV.RANK_SHEET_ID}!A${firstEmpty + i}:K${firstEmpty + i}`,
          values: [row],
        })),
      }),
    })
    if (res.code && res.code !== 0) throw new Error("追加玩家失败: " + res.code + " " + res.msg)
  }
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

  // CORS 预检
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
    if (path === "/api/sync" && req.method === "POST") {
      if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: "unauthorized" })
      const body = JSON.parse((await readBody(req)) || "{}")
      if (!body.players || !body.players.length) return sendJson(res, 400, { ok: false, error: "players 不能为空" })
      const token = await getTenantToken()
      const recordRows = body.players.map((p) => [
        body.gameId, body.date, body.board, `${p.no}号`, p.name, p.role, p.camp,
        p.win ? "胜" : "负", p.base, p.skill, p.vote,
      ])
      await appendRecordRows(token, recordRows)
      await updateRanking(token, body.players.map((p) => ({ name: p.name, win: p.win, score: p.base + p.skill + p.vote })))
      sendJson(res, 200, { ok: true })
      return
    }
    sendJson(res, 404, { ok: false, error: "not found" })
  } catch (e) {
    sendJson(res, 500, { ok: false, error: (e && e.message) || String(e) })
  }
})

server.listen(PORT, () => {
  console.log(`🛰️ 狼人杀飞书同步桥接已启动: http://0.0.0.0:${PORT}`)
  console.log(`   表格: ${ENV.SPREADSHEET_TOKEN}`)
})
