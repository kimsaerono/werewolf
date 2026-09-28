/**
 * 同步链路韧性测试（部署端 server.cjs）
 *
 * 背景：线上出现过 500 {"ok":false,"error":"read ECONNRESET"}。根因两层：
 *   1) fetchJson 裸用 https.request，无超时无重试 → 一次网络抖动整局同步失败；
 *   2) 同步是多步非原子写，而 updateRanking 是「读改写累加」，
 *      失败后整体重试会把积分加两遍（gameId 提交点查重拦不住「半完成」状态）。
 *
 * 分工：本文件跑纯逻辑（错误分类、退避、步骤日志）；
 * socket 层的重试/超时必须用真实 Node 验证——Bun 的 node:http shim 不会触发
 * socket 'timeout' 事件，断开报错文案也不同，在 Bun 下断言 socket 行为不可信。
 * 故 socket 用例放在 sync-resilience-socket.cjs，由下方一个用例以 node 子进程拉起。
 */
import { describe, it, expect, afterEach } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))

// 退避基数调小，让重试用例跑得快
process.env.SYNC_BACKOFF_MS = "1"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const svc = require("../deploy/werewolf-sync/server.cjs") as {
  isRetryableError: (e: unknown) => boolean
  backoffMs: (attempt: number) => number
  runStep: (
    journal: Set<string> | null,
    step: string,
    label: string,
    fn: () => Promise<unknown>,
  ) => Promise<void>
  stepJournalFor: (gameId: string) => Set<string>
  clearStepJournal: (gameId: string) => void
  cellHasGameId: (cell: unknown, gameId: unknown) => boolean
  STEP_JOURNAL: Map<string, Set<string>>
}

afterEach(() => {
  svc.STEP_JOURNAL.clear()
})

describe("cellHasGameId（复盘 A 列查重）", () => {
  const cellHasGameId = svc.cellHasGameId
  it("旧 14 列布局：A 列整格就是 gameId", () => {
    expect(cellHasGameId("第1局", "第1局")).toBe(true)
  })
  it("卡片块 F 布局：A 列是多行合并块，仍能命中首行", () => {
    const a =
      "🎮 第1局｜2026/9/28\n🃏 板子：狼人×3\n⚔️ 胜负：狼人胜利\n📋 原因：屠边\n\n📜 对局日志\n 1. 天亮 9号被刀"
    expect(cellHasGameId(a, "第1局")).toBe(true)
  })
  it("卡片块 G 布局：gameId 在首行中间，也能命中", () => {
    expect(cellHasGameId("2026/9/28  第1局  🧑‍⚖️ 法官：柴  狼人胜利", "第1局")).toBe(true)
  })
  it("首行不含该 gameId → 不命中", () => {
    expect(cellHasGameId("🎮 第5局｜2026/9/28", "第1局")).toBe(false)
  })
  it("「第1局」不误配「第11局」「第10局」", () => {
    expect(cellHasGameId("🎮 第11局｜2026/9/28", "第1局")).toBe(false)
    expect(cellHasGameId("🎮 第10局｜2026/9/28", "第1局")).toBe(false)
  })
  it("「第2局」不误配「第21局」「第22局」", () => {
    expect(cellHasGameId("🎮 第21局｜2026/9/28", "第2局")).toBe(false)
    expect(cellHasGameId("🎮 第22局｜2026/9/28", "第2局")).toBe(false)
  })
  it("gameId 只出现在正文（非首行）不算命中", () => {
    expect(cellHasGameId("🃏 板子说明\n第1局 其实是这个", "第1局")).toBe(false)
  })
  it("空值 / 空 gameId 安全返回 false", () => {
    expect(cellHasGameId(null, "第1局")).toBe(false)
    expect(cellHasGameId(undefined, "第1局")).toBe(false)
    expect(cellHasGameId("", "第1局")).toBe(false)
    expect(cellHasGameId("第1局", "")).toBe(false)
  })
})

describe("瞬时错误分类与退避", () => {
  it("只对连接类错误重试，业务/配置错误不重试", () => {
    const e = (code: string) => Object.assign(new Error(code), { code })
    for (const c of ["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH"]) {
      expect(svc.isRetryableError(e(c))).toBe(true)
    }
    // 业务错误重试没有意义，只会拖慢并放大副作用
    expect(svc.isRetryableError(e("ENOTFOUND"))).toBe(false)
    expect(svc.isRetryableError(new Error("读取失败: 91403"))).toBe(false)
    expect(svc.isRetryableError(new Error("players 不能为空"))).toBe(false)
    expect(svc.isRetryableError(null)).toBe(false)
  })

  it("退避随重试次数增长且有上限（含抖动）", () => {
    expect(svc.backoffMs(1)).toBeGreaterThan(0)
    expect(svc.backoffMs(5)).toBeGreaterThan(svc.backoffMs(1))
    // 上限 5000ms，抖动最多 ×1.3
    expect(svc.backoffMs(20)).toBeLessThanOrEqual(5000 * 1.31)
  })
})

describe("同步步骤日志：失败重试不重复累加", () => {
  it("已完成的步骤在重试时被跳过", async () => {
    const j = svc.stepJournalFor("g-dup")
    let calls = 0
    await svc.runStep(j, "ranking", "更新排名", async () => {
      calls += 1
    })
    await svc.runStep(j, "ranking", "更新排名", async () => {
      calls += 1
    })
    expect(calls).toBe(1)
  })

  it("失败步骤不写入日志，重试会真正再执行一次", async () => {
    const j = svc.stepJournalFor("g-fail")
    await expect(
      svc.runStep(j, "ranking", "更新排名", async () => {
        throw new Error("read ECONNRESET")
      }),
    ).rejects.toThrow("更新排名失败：read ECONNRESET")
    expect(j.has("ranking")).toBe(false)
    let calls = 0
    await svc.runStep(j, "ranking", "更新排名", async () => {
      calls += 1
    })
    expect(calls).toBe(1)
  })

  it("错误信息带步骤名，便于定位断在哪一步", async () => {
    const j = svc.stepJournalFor("g-label")
    await expect(
      svc.runStep(j, "archive", "季度归档", async () => {
        throw new Error("read ECONNRESET")
      }),
    ).rejects.toThrow("季度归档失败：read ECONNRESET")
  })

  it("journal 为 null 时每步都执行（不改变原有语义）", async () => {
    let calls = 0
    await svc.runStep(null, "a", "步骤A", async () => {
      calls += 1
    })
    await svc.runStep(null, "a", "步骤A", async () => {
      calls += 1
    })
    expect(calls).toBe(2)
  })

  it("端到端：排名已累加后中断，重试不会把积分加两遍", async () => {
    const j = svc.stepJournalFor("第3局")
    let score = 0
    const addScore = async () => {
      score += 3
    }

    // 首次同步：排名累加成功，随后写复盘行时网络被重置
    await svc.runStep(j, "ranking", "更新排名", addScore)
    await expect(
      svc.runStep(j, "record", "写复盘行", async () => {
        throw new Error("read ECONNRESET")
      }),
    ).rejects.toThrow("写复盘行失败：read ECONNRESET")

    // 用户重试：排名步骤被跳过，只补写复盘行
    await svc.runStep(j, "ranking", "更新排名", addScore)
    await svc.runStep(j, "record", "写复盘行", async () => {})

    expect(score).toBe(3) // 关键断言：不是 6
    svc.clearStepJournal("第3局")
    expect(svc.STEP_JOURNAL.has("第3局")).toBe(false)
  })

  it("日志按 gameId 隔离，互不影响", async () => {
    const a = svc.stepJournalFor("第1局")
    const b = svc.stepJournalFor("第2局")
    let aCalls = 0
    let bCalls = 0
    await svc.runStep(a, "ranking", "更新排名", async () => {
      aCalls += 1
    })
    await svc.runStep(b, "ranking", "更新排名", async () => {
      bCalls += 1
    })
    await svc.runStep(a, "ranking", "更新排名", async () => {
      aCalls += 1
    })
    expect(aCalls).toBe(1)
    expect(bCalls).toBe(1)
  })

  it("日志容量有上限，不会无限增长", () => {
    for (let i = 0; i < 120; i++) svc.stepJournalFor(`批量-${i}`)
    expect(svc.STEP_JOURNAL.size).toBeLessThanOrEqual(50)
  })
})

describe("socket 层（真实 Node 运行时）", () => {
  it("重试/超时/状态码处理在 Node 下全部通过", () => {
    const r = spawnSync("node", [join(here, "sync-resilience-socket.cjs")], { encoding: "utf8" })
    if (r.status !== 0) {
      throw new Error(`Node socket 层测试失败：\n${r.stdout || ""}\n${r.stderr || ""}`)
    }
    expect(r.stdout).toContain("0 fail")
  }, 30000)
})
