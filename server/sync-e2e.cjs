#!/usr/bin/env node
/**
 * 端到端验证：真实 server.cjs + mock 飞书 OpenAPI
 *
 * 目的：证明线上那个 500（read ECONNRESET）在真实进程、真实多步写入流程下
 * 已被修好，并且「失败后重试」不会把积分加两遍。
 *
 * 做法：
 *   - 起一个 mock 飞书服务（内存表格），可按需在指定请求上「断连」注入 ECONNRESET
 *   - 用 FEISHU_BASE 指过去，spawn 真实的 deploy/werewolf-sync/server.cjs
 *   - 跑若干场景，断言：最终成功、积分不重复、错误带步骤名
 *
 * 运行：node server/sync-e2e.cjs
 */
"use strict"

const http = require("http")
const { spawn } = require("child_process")
const path = require("path")

const SERVER_CJS = path.join(__dirname, "../deploy/werewolf-sync/server.cjs")
const PASSWORD = "e2e-test-password"
const RANK_SHEET = "rankSheet1"
const TOKEN = "mock-token"

// ===== mock 飞书 =====
/** sheetId → { title, rows: string[][] } */
let sheets = null
let requests = []
/** 断连注入器：命中则 destroy socket（制造 ECONNRESET） */
let fault = null

function newStore() {
  const s = new Map()
  // 排名表：A排名 B昵称 C场次 D胜 E负 F胜率 G积分
  s.set(RANK_SHEET, {
    title: "积分统计排名",
    rows: [
      ["排名", "昵称", "场次", "胜", "负", "胜率", "积分", "法官分", "MVP", "SVP", "背锅"],
      ["1", "张三", 2, 1, 1, "50.00%", 6, 1, 0, 0, 0],
      ["2", "李四", 1, 0, 1, "0.00%", -2, 0, 0, 0, 0],
    ],
  })
  // 旧「每局复盘记录」tab：hasGameId 幂等查重会读它
  s.set("legacySheet", { title: "每局复盘记录", rows: [["第0局"]] })
  return s
}

function colNum(letters) {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}
function parseCell(ref) {
  const m = String(ref).match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  return { col: colNum(m[1]), row: Number(m[2]) }
}
function sliceRange(rows, a1, b1) {
  const s = parseCell(a1) || { row: 1, col: 1 }
  const e = parseCell(b1) || { row: Math.max(rows.length, 1), col: 11 }
  const out = []
  for (let r = s.row; r <= e.row; r++) {
    const line = []
    for (let c = s.col; c <= e.col; c++) {
      const cell = rows[r - 1]
      line.push(cell && cell[c - 1] !== undefined ? cell[c - 1] : null)
    }
    while (line.length && line[line.length - 1] === null) line.pop()
    out.push(line)
  }
  while (out.length && out[out.length - 1].length === 0) out.pop()
  return out
}
function writeRange(rows, a1, values) {
  const s = parseCell(a1)
  if (!s) throw new Error("bad start cell " + a1)
  for (let i = 0; i < values.length; i++) {
    const r = s.row - 1 + i
    while (rows.length <= r) rows.push([])
    for (let j = 0; j < values[i].length; j++) {
      rows[r][s.col - 1 + j] = values[i][j]
    }
  }
  return rows
}

function sendJson(res, obj) {
  const b = JSON.stringify(obj)
  res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) })
  res.end(b)
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ""
    req.on("data", (c) => (d += c))
    req.on("end", () => {
      try {
        resolve(JSON.parse(d || "{}"))
      } catch {
        resolve({})
      }
    })
  })
}

async function startMock() {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x")
    const p = u.pathname
    const body = req.method === "POST" ? await readBody(req) : {}
    requests.push({ method: req.method, url: req.url })

    // 故障注入：命中且次数未耗尽则断连（对端看到 ECONNRESET）
    if (fault) {
      const f = fault
      const hasBudget = typeof f.times === "number" ? f.times > 0 : true
      const matched = !f.match || f.match(req, body)
      if (hasBudget && matched) {
        if (typeof f.times === "number") f.times -= 1
        req.socket.destroy()
        return
      }
      // 次数耗尽后放行，不能挂起（否则客户端只能等到超时）
    }

    // 取 token
    if (p.includes("/auth/v3/tenant_access_token/internal")) {
      return sendJson(res, { code: 0, tenant_access_token: TOKEN, expire: 7200 })
    }
    // 列子表
    if (p.endsWith("/sheets/query")) {
      return sendJson(res, {
        code: 0,
        data: { sheets: [...sheets.entries()].map(([sheet_id, s]) => ({ sheet_id, title: s.title })) },
      })
    }
    // 建表 / 样式类（无副作用）
    if (p.endsWith("/sheets_batch_update")) {
      const req0 = (body.requests || [])[0] || {}
      if (req0.addSheet) {
        const title = req0.addSheet.properties.title
        const id = "sheet_" + Buffer.from(title).toString("hex").slice(0, 12)
        sheets.set(id, { title, rows: [] })
        return sendJson(res, { code: 0, data: { replies: [{ addSheet: { properties: { sheetId: id } } }] } })
      }
      return sendJson(res, { code: 0, data: {} })
    }
    if (/styles_batch_update|merge_cells|dimension_range|frozen_rows/.test(p)) {
      return sendJson(res, { code: 0, data: {} })
    }
    // 读值：.../values/{sheetId}!{range}
    if (/\/values\//.test(p)) {
      const raw = decodeURIComponent(p.split("/values/")[1])
      const bang = raw.indexOf("!")
      const sheetId = raw.slice(0, bang)
      const range = raw.slice(bang + 1)
      const sh = sheets.get(sheetId)
      if (!sh) return sendJson(res, { code: 91403, msg: "sheet not found" })
      const [a1, b1] = range.split(":")
      return sendJson(res, { code: 0, data: { valueRange: { values: sliceRange(sh.rows, a1 || "A1", b1) } } })
    }
    // 写值
    if (p.endsWith("/values_batch_update")) {
      for (const vr of body.valueRanges || []) {
        const bang = vr.range.indexOf("!")
        const sheetId = vr.range.slice(0, bang)
        const range = vr.range.slice(bang + 1)
        const sh = sheets.get(sheetId)
        if (!sh) return sendJson(res, { code: 91403, msg: "sheet not found" })
        const a1 = range.split(":")[0]
        writeRange(sh.rows, a1, vr.values || [])
      }
      return sendJson(res, { code: 0, data: { updatedCells: 1 } })
    }
    return sendJson(res, { code: 0, data: {} })
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}

// ===== 驱动真实 server.cjs =====
function startSyncService(feishuBase, port) {
  const child = spawn("node", [SERVER_CJS], {
    env: {
      ...process.env,
      FEISHU_BASE: feishuBase,
      APP_ID: "cli_test",
      APP_SECRET: "secret",
      SPREADSHEET_TOKEN: "mockbook",
      RANK_SHEET_ID: RANK_SHEET,
      RECORD_SHEET_ID: "legacySheet",
      ACCESS_PASSWORD: PASSWORD,
      SYNC_BACKOFF_MS: "20",
      SYNC_REQ_TIMEOUT_MS: "3000",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const logs = []
  child.stdout.on("data", (d) => logs.push(d.toString()))
  child.stderr.on("data", (d) => logs.push(d.toString()))
  return { child, logs }
}

function waitHealthy(port, tries = 60) {
  return new Promise((resolve) => {
    const tick = async (n) => {
      if (n <= 0) return resolve(false)
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/health`)
        if (r.ok) return resolve(true)
      } catch {}
      setTimeout(() => tick(n - 1), 100)
    }
    tick(tries)
  })
}

function payload(gameId, names) {
  return {
    gameId,
    date: "2026/9/28",
    board: "9",
    winCamp: "wolf",
    winner: "狼人胜利",
    reason: "屠边",
    boardFinal: "狼人×3 预言家×1 …",
    judgeScore: 0,
    mvp: "",
    svp: "",
    beiguo: "",
    logLines: ["天亮 狼人刀人 9号"],
    judge: { name: "柴秀彬", score: 0.5 },
    players: names.map((n, i) => ({
      no: i + 1,
      name: n,
      role: i === 0 ? "狼人" : "平民",
      camp: i === 0 ? "狼人" : "平民",
      win: i === 0,
      base: i === 0 ? 3 : -1,
      skill: 0,
      vote: 0,
    })),
  }
}

async function post(port, body) {
  const r = await fetch(`http://127.0.0.1:${port}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-access-password": PASSWORD },
    body: JSON.stringify(body),
  })
  return { status: r.status, json: await r.json() }
}

/** 从 mock 的排名表里读某人的积分（G 列，index 6） */
/** 本次写值请求是否命中排名表（用于把故障精确注入到「写复盘」而不是「写排名」） */
function isRankWrite(body) {
  return (body.valueRanges || []).some((vr) => String(vr.range || "").split("!")[0] === RANK_SHEET)
}

function scoreOf(name) {
  const sh = sheets.get(RANK_SHEET)
  for (let i = 1; i < sh.rows.length; i++) {
    if (String(sh.rows[i][1]) === name) return Number(sh.rows[i][6]) || 0
  }
  return null
}
function monthSheet() {
  for (const [, s] of sheets) if (s.title.includes("复盘")) return s
  return null
}

// ===== 场景 =====
const results = []
async function scenario(name, fn) {
  try {
    await fn()
    results.push({ name, pass: true })
  } catch (e) {
    results.push({ name, pass: false, err: (e && e.message) || String(e) })
  }
}
function assert(c, m) {
  if (!c) throw new Error(m)
}

async function main() {
  sheets = newStore()
  requests = []
  fault = null
  const { server: mock, base } = await startMock()
  const PORT = 34661
  const svc = startSyncService(base, PORT)
  const healthy = await waitHealthy(PORT)
  if (!healthy) {
    console.log("  ✗ 同步服务未能启动（mock:" + base + "）")
    svc.logs.forEach((l) => console.log("      " + l.trim()))
    svc.child.kill()
    mock.close()
    process.exit(1)
  }

  try {
    // 1. 正常同步
    await scenario("正常同步成功，并累加到排名表", async () => {
      const r = await post(PORT, payload("第1局", ["张三", "李四", "王五"]))
      assert(r.status === 200 && r.json.ok, `期望 ok，实际 ${r.status} ${JSON.stringify(r.json)}`)
      // 张三原 6 分，本局 base=+3 → 9
      assert(scoreOf("张三") === 9, `张三积分应为 9，实际 ${scoreOf("张三")}`)
      assert(monthSheet() !== null, "未建出当月复盘 tab")
    })

    // 2. 幂等：同一 gameId 再同步一次不应重复加分
    await scenario("同一 gameId 重复同步被幂等拦下，不重复加分", async () => {
      const before = scoreOf("张三")
      const r = await post(PORT, payload("第1局", ["张三", "李四", "王五"]))
      assert(r.status === 200 && r.json.ok, `期望 ok，实际 ${r.status} ${JSON.stringify(r.json)}`)
      assert(scoreOf("张三") === before, `重复同步后积分变了：${before} → ${scoreOf("张三")}`)
    })

    // 3. 关键场景：写复盘行时持续断连 → 整局必须失败，且排名不能被重复累加
    await scenario("复盘写入持续断连：返回带步骤名的错误", async () => {
      const before = scoreOf("张三")
      // 只命中「写值且不是排名表」的请求（即写复盘行），注入 20 次（超过重试上限）→ 必须失败
      fault = {
        match: (req, body) => req.url.includes("values_batch_update") && !isRankWrite(body),
        times: 20,
      }
      const r = await post(PORT, payload("第2局", ["张三", "李四", "赵六"]))
      fault = null
      assert(r.status === 500, `期望 500，实际 ${r.status} ${JSON.stringify(r.json)}`)
      assert(/复盘|写复盘行/.test(r.json.error), `错误应带步骤名，实际「${r.json.error}」`)
      // 排名这一步在断连注入前已成功，所以分数应当增加了（这是预期：重试要能补上）
      assert(scoreOf("张三") === before + 3, `排名累加应生效一次，实际 ${before} → ${scoreOf("张三")}`)
    })

    // 4. 同一 gameId 重试：只补未完成步骤，排名不得再加一遍
    await scenario("重试只补未完成步骤，积分不被加两遍", async () => {
      const before = scoreOf("张三")
      const r = await post(PORT, payload("第2局", ["张三", "李四", "赵六"]))
      assert(r.status === 200 && r.json.ok, `重试应成功，实际 ${r.status} ${JSON.stringify(r.json)}`)
      assert(scoreOf("张三") === before, `重试导致积分被重复累加：${before} → ${scoreOf("张三")}`)
    })

    // 5. 瞬时断连（只 2 次）应被重试吸收，同步照常成功
    await scenario("瞬时断连（2 次）被重试吸收，同步照常成功", async () => {
      const before = scoreOf("李四")
      fault = { match: (req) => req.url.includes("values_batch_update"), times: 2 }
      const r = await post(PORT, payload("第3局", ["李四", "钱七", "孙八"]))
      fault = null
      assert(r.status === 200 && r.json.ok, `期望重试后成功，实际 ${r.status} ${JSON.stringify(r.json)}`)
      // 队首是狼人且获胜 → +3
      assert(scoreOf("李四") === before + 3, `李四积分应 +3，实际 ${scoreOf("李四")}（原 ${before}）`)
    })

    // 6. 模拟线上原始故障形态：整局多处零星断连
    await scenario("多处零星断连（模拟线上抖动）仍能完成同步", async () => {
      const before = scoreOf("王五")
      let i = 0
      fault = {
        match: () => {
          i += 1
          return i % 3 === 0 // 每 3 个请求断一次
        },
        times: 6,
      }
      const r = await post(PORT, payload("第4局", ["王五", "周九", "吴十"]))
      fault = null
      assert(r.status === 200 && r.json.ok, `期望成功，实际 ${r.status} ${JSON.stringify(r.json)}`)
      assert(scoreOf("王五") === before + 3, `王五积分应 +3，实际 ${scoreOf("王五")}（原 ${before}）`)
    })
  } finally {
    svc.child.kill()
    mock.close()
  }

  for (const r of results) {
    if (r.pass) console.log(`  ✓ ${r.name}`)
    else {
      console.log(`  ✗ ${r.name}`)
      console.log(`      ${r.err}`)
    }
  }
  const failed = results.filter((r) => !r.pass).length
  console.log(`  ${results.length - failed} pass / ${failed} fail`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error("e2e 自身异常：", e)
  process.exit(2)
})
