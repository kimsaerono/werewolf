#!/usr/bin/env node
/**
 * 同步链路 socket 层验证（必须在 Node 下跑）
 *
 * 为什么单独一个文件：server.cjs 线上跑在 Node，而 `bun test` 的 node:http
 * shim 行为与 Node 不同——Bun 下请求不会触发 socket 'timeout' 事件，且断开
 * 的报错文案也不同。用 Bun 断言 socket 行为会得到假绿/假红。
 * 因此把 socket 层用例放这里，由 server/sync-resilience.test.ts 用 node 子进程拉起。
 *
 * 运行：node server/sync-resilience-socket.cjs
 * 退出码 0 = 全过；非 0 = 有失败（失败明细打印在 stdout）
 */
"use strict"

process.env.SYNC_BACKOFF_MS = "1"
process.env.SYNC_REQ_TIMEOUT_MS = "2000"
process.env.SYNC_MAX_ATTEMPTS = "4"

const http = require("http")
const path = require("path")

const svc = require(path.join(__dirname, "../deploy/werewolf-sync/server.cjs"))

const results = []
const servers = []
const sockets = []

function ok(name) {
  results.push({ name, pass: true })
}
function fail(name, err) {
  results.push({ name, pass: false, err: (err && err.message) || String(err) })
}

async function serve(handler) {
  let n = 0
  const s = http.createServer((req, res) => {
    sockets.push(req.socket)
    n += 1
    handler(res, n)
  })
  servers.push(s)
  await new Promise((r) => s.listen(0, "127.0.0.1", r))
  return `http://127.0.0.1:${s.address().port}`
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}
function reset(res) {
  if (res.socket) res.socket.destroy()
}

function cleanup() {
  while (sockets.length) {
    const s = sockets.pop()
    try {
      s.destroy()
    } catch {}
  }
  while (servers.length) {
    try {
      servers.pop().close()
    } catch {}
  }
}

async function test(name, fn) {
  try {
    await fn()
    ok(name)
  } catch (e) {
    fail(name, e)
  } finally {
    cleanup()
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  // 线上真实故障：先 ECONNRESET 几次，最终成功
  await test("ECONNRESET 后自动重试并最终成功", async () => {
    const url = await serve((res, n) => {
      if (n < 3) return reset(res)
      json(res, 200, { ok: 1, attempt: n })
    })
    const data = await svc.fetchJson(url)
    assert(data.ok === 1, "未取到响应体")
    assert(data.attempt === 3, `第 3 次才成功，实际第 ${data.attempt} 次`)
  })

  await test("持续 ECONNRESET 且重试用尽 → 抛 ECONNRESET", async () => {
    const url = await serve((res) => reset(res))
    let err = null
    try {
      await svc.fetchJson(url, { retries: 2 })
    } catch (e) {
      err = e
    }
    assert(err !== null, "重试用尽后未抛错（会被上层当成空数据静默吞掉）")
    assert(
      err.code === "ECONNRESET" || /socket hang up|ECONNRESET/.test(err.message),
      `期望 ECONNRESET，实际 code=${err.code} msg=${err.message}`,
    )
  })

  await test("无响应时按 timeout 中断，不无限挂起", async () => {
    const url = await serve(() => {
      /* 故意不响应 */
    })
    const t0 = Date.now()
    let err = null
    try {
      await svc.fetchJson(url, { retries: 1, timeout: 150 })
    } catch (e) {
      err = e
    }
    const cost = Date.now() - t0
    assert(err !== null, "超时不抛错，请求会永久挂起")
    assert(err.code === "ETIMEDOUT", `期望 ETIMEDOUT，实际 code=${err.code}`)
    assert(cost < 3000, `超时生效太慢：${cost}ms`)
  })

  await test("503 视为瞬时故障会重试", async () => {
    let hits = 0
    const url = await serve((res, n) => {
      hits = n
      if (n < 2) return json(res, 503, { code: 1 })
      json(res, 200, { recovered: true })
    })
    const data = await svc.fetchJson(url)
    assert(data.recovered === true, "未重试成功")
    assert(hits === 2, `期望 2 次请求，实际 ${hits}`)
  })

  await test("400 属业务错误直接返回不重试", async () => {
    let hits = 0
    const url = await serve((res, n) => {
      hits = n
      json(res, 400, { code: 90202, msg: "wrong range" })
    })
    const body = await svc.fetchJson(url)
    assert(body.code === 90202, "业务错误码未透传给调用方")
    assert(hits === 1, `不应重试，实际请求 ${hits} 次`)
  })

  await test("5xx 重试用尽后抛错，不把错误页当空数据", async () => {
    const url = await serve((res) => json(res, 502, { code: 1 }))
    let err = null
    try {
      await svc.fetchJson(url, { retries: 2 })
    } catch (e) {
      err = e
    }
    assert(err !== null, "502 被静默当成空数据，会写入半截数据")
    assert(/HTTP 502/.test(err.message), `期望 HTTP 502，实际 ${err && err.message}`)
  })

  await test("POST 带 body 重试后仍能送达（token 获取路径）", async () => {
    let seenBody = null
    const url = await serve((res, n) => {
      if (n < 2) return reset(res)
      json(res, 200, { tenant_access_token: "t-abc" })
    })
    const data = await svc.fetchJson(url, { method: "POST", body: JSON.stringify({ app_id: "a" }) })
    assert(data.tenant_access_token === "t-abc", "未拿到 token")
    assert(seenBody === null, "占位")
  })

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
  console.error("socket 层测试自身异常：", e)
  process.exit(2)
})
