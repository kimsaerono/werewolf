import { describe, it, expect } from "bun:test"
import { buildRecordBlock, buildRecordOps, blockToCsv } from "./recordBlock"
import type { SyncPayload } from "../src/api/feishuSync"

function payload(over: Partial<SyncPayload> = {}): SyncPayload {
  return {
    gameId: "真实·第1局 · 2026年8月21日",
    date: "2026/8/21 12:33:54",
    board: "8a",
    boardFinal: "狼人×3 预言家×1 女巫×1 平民×3",
    winCamp: "wolf",
    winner: "狼人胜利",
    reason: "屠边",
    judgeScore: 0.5,
    mvp: "武战峰",
    svp: "",
    beiguo: "赵妍",
    logLines: ["✅本局开始：发牌", "🌙第1晚：狼人刀了 1.赵妍(女巫)"],
    judge: { name: "王童", score: 0.5 },
    players: [
      { no: 1, name: "赵妍", role: "女巫", camp: "神职", win: false, base: 0, skill: -0.5, vote: 0 },
      { no: 2, name: "武战峰", role: "狼人", camp: "狼人", win: true, base: 3, skill: 0.5, vote: 0 },
    ],
    ...over,
  }
}

describe("buildRecordBlock 卡片区块", () => {
  it("标题行：A 列局次、B 列含板子/胜负/原因/法官", () => {
    const b = buildRecordBlock(payload(), 10)
    expect(b.rows[0][0]).toBe("真实·第1局 · 2026年8月21日")
    expect(b.rows[0][1]).toContain("狼人×3 预言家×1 女巫×1 平民×3板")
    expect(b.rows[0][1]).toContain("狼人胜利（屠边）")
    expect(b.rows[0][1]).toContain("法官：王童")
    expect(b.titleRow).toBe(10)
  })

  it("信息行：时间+MVP+背锅侠，空 SVP 不出现", () => {
    const b = buildRecordBlock(payload(), 2)
    expect(b.rows[1][1]).toContain("⏰ 时间：2026/8/21 12:33:54")
    expect(b.rows[1][1]).toContain("🏆 MVP：武战峰")
    expect(b.rows[1][1]).toContain("背锅侠：赵妍")
    expect(b.rows[1][1]).not.toContain("SVP")
  })

  it("积分行：每人号码(身份) +带符号一位小数分值", () => {
    const b = buildRecordBlock(payload(), 2)
    expect(b.rows[2][1]).toContain("1.赵妍(女巫) -0.5")
    expect(b.rows[2][1]).toContain("2.武战峰(狼人) +3.5")
  })

  it("日志逐行编号，末尾空行分隔；合并范围为 B:N 三行", () => {
    const b = buildRecordBlock(payload(), 5)
    expect(b.rows[3]).toEqual(["", "1. ✅本局开始：发牌"])
    expect(b.rows[4]).toEqual(["", "2. 🌙第1晚：狼人刀了 1.赵妍(女巫)"])
    expect(b.rows[5]).toEqual(["", ""])
    expect(b.rows).toHaveLength(6)
    expect(b.mergeRanges).toEqual(["B5:N5"])
    expect(b.logStartRow).toBe(8)
    expect(b.logEndRow).toBe(9)
  })

  it("无日志/字段缺失兜底：不炸、无日志样式区", () => {
    const b = buildRecordBlock(payload({ logLines: undefined, winner: undefined, boardFinal: "", judge: null }), 1)
    expect(b.rows).toHaveLength(4)
    expect(b.rows[0][1]).toContain("8a板")
    expect(b.rows[0][1]).toContain("-（屠边）")
    expect(b.rows[0][1]).toContain("法官：-")
    expect(b.logEndRow).toBeLessThan(b.logStartRow)
  })

  it("积分不分段：多人单行溢出显示，仅标题行合并", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      no: i + 1, name: `玩家${i + 1}`, role: "平民", camp: "平民", win: true, base: 1, skill: 0, vote: 0,
    }))
    const b = buildRecordBlock(payload({ players: many }), 10)
    expect(b.rows[2][1]).toMatch(/^积分：1\.玩家1/)
    expect(b.rows[2][1]).toContain("9.玩家9")
    expect(b.rows[3]).toEqual(["", "1. ✅本局开始：发牌"])
    expect(b.mergeRanges).toEqual(["B10:N10"])
    expect(b.logStartRow).toBe(13)
    expect(b.logEndRow).toBe(14)
  })

  it("无玩家时无积分行", () => {
    const b = buildRecordBlock(payload({ players: [], logLines: [] }), 2)
    expect(b.rows).toHaveLength(3)
    expect(b.mergeRanges).toEqual(["B2:N2"])
    expect(JSON.stringify(b.rows)).not.toContain("积分")
  })
})

describe("blockToCsv 转义", () => {
  it("引号翻倍、逗号不拆列", () => {
    const b = buildRecordBlock(payload({ logLines: ['他说"天黑请闭眼"，然后闭眼'] }), 1)
    const csv = blockToCsv(b)
    const logRow = csv.split("\n").find((l) => l.includes("天黑请闭眼"))!
    expect(logRow).toBe('"","1. 他说""天黑请闭眼""，然后闭眼"')
  })
})

describe("buildRecordOps 批量子操作", () => {
  it("1 合并 + 标题样式(含底边框) + 信息样式 + 日志样式 + 3 行高，sheet_id 注入", () => {
    const b = buildRecordBlock(payload(), 20)
    const ops = buildRecordOps(b, "SHEET_X")
    const shortcuts = ops.map((o) => o.shortcut)
    expect(shortcuts.filter((s) => s === "+cells-merge")).toHaveLength(1)
    expect(shortcuts.filter((s) => s === "+cells-set-style")).toHaveLength(3)
    expect(shortcuts.filter((s) => s === "+rows-resize")).toHaveLength(3)
    for (const o of ops) expect(o.input.sheet_id).toBe("SHEET_X")
    const titleStyle = ops.find((o) => o.shortcut === "+cells-set-style")!
    expect(titleStyle.input.range).toBe("A20:N20")
    expect(titleStyle.input.background_color).toBe("#1668dc")
    expect(titleStyle.input.border_type).toBe("BOTTOM_BORDER")
    const logStyle = ops.filter((o) => o.shortcut === "+cells-set-style")[2]
    expect(logStyle.input.range).toBe(`B${b.logStartRow}:B${b.logEndRow}`)
    const titleResize = ops.find((o) => o.shortcut === "+rows-resize")!
    expect(titleResize.input.range).toBe("20:20")
  })

  it("无日志时只有 2 个样式操作", () => {
    const b = buildRecordBlock(payload({ logLines: [] }), 2)
    const ops = buildRecordOps(b, "S")
    expect(ops.filter((o) => o.shortcut === "+cells-set-style")).toHaveLength(2)
  })

  it("行高：标题 30、内容 20、分隔 10", () => {
    const b = buildRecordBlock(payload(), 20)
    const ops = buildRecordOps(b, "S")
    const resizes = ops.filter((o) => o.shortcut === "+rows-resize")
    expect(resizes).toHaveLength(3)
    expect(resizes[0].input.height).toBe(30)
    expect(resizes[1].input.height).toBe(20)
    const sepRow = 20 + b.rows.length - 1
    expect(resizes[2].input.range).toBe(`${sepRow}:${sepRow}`)
    expect(resizes[2].input.height).toBe(10)
  })
})

describe("部署端 record-block.cjs 与 TS 版一致性", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cjs = require("../deploy/werewolf-sync/record-block.cjs") as {
    buildRecordBlock: typeof buildRecordBlock
    fmtScore: (n: number) => string
  }

  it("完整 payload 输出与 TS 版逐字段一致", () => {
    const p = payload()
    expect(cjs.buildRecordBlock(p, 10)).toEqual(buildRecordBlock(p, 10))
  })

  it("9 人分段 payload 输出与 TS 版一致", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      no: i + 1, name: `玩家${i + 1}`, role: "平民", camp: "平民", win: true, base: 1, skill: 0, vote: 0,
    }))
    const p = payload({ players: many })
    expect(cjs.buildRecordBlock(p, 3)).toEqual(buildRecordBlock(p, 3))
  })

  it("缺字段兜底输出与 TS 版一致", () => {
    const p = payload({ logLines: undefined, winner: undefined, boardFinal: "", judge: null, mvp: "", beiguo: "" })
    expect(cjs.buildRecordBlock(p, 3)).toEqual(buildRecordBlock(p, 3))
  })

  it("fmtScore 与 TS 行为一致", () => {
    for (const n of [0, 0.05, -0.5, 3.5, -2.34, 10]) expect(cjs.fmtScore(n)).toBe(fmtScoreRef(n))
  })
})

/** TS 版 fmtScore 同逻辑参考实现 */
function fmtScoreRef(n: number): string {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`
}
