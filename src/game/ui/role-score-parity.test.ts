import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { defaultState, newPlayer, recalcScore, GOD_LIST, type GameState } from "../logic"
import { getRoleInstance } from "../roles/builtin"

/**
 * 新角色护栏：帮助文案（RoleHelp.vue 的 score 字段）与真实计分逻辑一致性。
 *
 * 帮助文案是硬编码字符串，scoreRules() 是代码；二者没有天然同步机制。
 * 本文件把「文案漂移 / 写错数字」变成测试红。
 *
 * 口径：**宽松匹配** —— 只要求 scoreRules 的 reason 关键词命中 + delta 数值与
 * 文案里的 +/-N 对齐，允许文案措辞微调；不要求逐字一致。
 */

const HELP = readFileSync(new URL("../../components/RoleHelp.vue", import.meta.url), "utf8")

/** 从 RoleHelp.vue 提取 ROLE_INFO 里每个角色的 score 文案 */
function parseRoleScoreText(): Record<string, string> {
  const out: Record<string, string> = {}
  // 匹配 `  角色名: {\n    play: "...",\n    score: "..."`（角色名为中文/字母）
  const re = /^\s{2}([\u4e00-\u9fa5A-Za-z]+):\s*\{\s*\n\s*play:\s*"[\s\S]*?",\s*\n\s*score:\s*"([^"]*)"/gm
  for (const m of HELP.matchAll(re)) out[m[1]] = m[2]
  return out
}

const SCORE_TEXT = parseRoleScoreText()

/** 简单构造：一个玩家 + 该角色，mark 预置 */
function makeRoleState(role: string, mark: Record<string, unknown> = {}) {
  const st = defaultState()
  const p = newPlayer("P1")
  p.role = role
  Object.assign(p.mark, mark)
  st.players = [p]
  return { st, p }
}

function entriesFor(role: string, mark: Record<string, unknown>) {
  const { st, p } = makeRoleState(role, mark)
  const inst = getRoleInstance(role)
  expect(inst, `角色 ${role} 缺少实例`).toBeTruthy()
  return inst!.scoreRules(st, p as unknown as { name: string; role: string; mark: Record<string, unknown> })
}

/** 在 scoreRules 产出中查找语义对应项（按 reason 关键词） */
function findEntry(role: string, mark: Record<string, unknown>, keyword: string) {
  return entriesFor(role, mark).find((e) => e.reason.includes(keyword))
}

/** 断言文案里出现某个含义串（宽松：只查子串） */
function expectText(role: string, sub: string) {
  const text = SCORE_TEXT[role]
  expect(text, `RoleHelp.vue 未解析到 ${role} 的 score 文案`).toBeTruthy()
  expect(text, `${role} 文案缺少「${sub}」`).toContain(sub)
}

describe("新角色计分护栏：ROLE_INFO 解析健壮性", () => {
  const NEW_ROLES = ["隐狼", "噩梦之影", "血月使徒", "猎魔人", "摄梦人", "野孩子", "炸弹人"]
  it("7 个新角色都能从 RoleHelp.vue 解析出非空 score 文案", () => {
    for (const r of NEW_ROLES) {
      expect(SCORE_TEXT[r], `未解析到 ${r} 的 score`).toBeTruthy()
      expect(SCORE_TEXT[r].length).toBeGreaterThan(0)
    }
  })
})

describe("新角色计分护栏：文案 ↔ scoreRules 数值一致", () => {
  it("噩梦之影：恐狼空刀 -1、恐神职 +0.5", () => {
    const wolf = findEntry("噩梦之影", { fearWolfCount: 1 }, "恐狼")
    expect(wolf, "缺少「恐狼」计分项").toBeTruthy()
    expect(wolf!.delta).toBe(-1)
    expectText("噩梦之影", "-1")
    expect(SCORE_TEXT["噩梦之影"]).toContain("空刀")

    const god = findEntry("噩梦之影", { fearGodCount: 1 }, "恐神")
    expect(god).toBeTruthy()
    expect(god!.delta).toBe(0.5)
    expectText("噩梦之影", "+0.5")
  })

  it("血月使徒：自爆封印神职 +0.5", () => {
    const seal = findEntry("血月使徒", { bloodSealCount: 1 }, "血月封印")
    expect(seal).toBeTruthy()
    expect(seal!.delta).toBe(0.5)
    expectText("血月使徒", "+0.5")
    expect(SCORE_TEXT["血月使徒"]).toContain("封印")
  })

  it("猎魔人：戳中狼 +0.5、戳错好人 -0.5", () => {
    const wk = findEntry("猎魔人", { huntWolfCount: 1 }, "击杀狼")
    expect(wk).toBeTruthy()
    expect(wk!.delta).toBe(0.5)
    expect(SCORE_TEXT["猎魔人"]).toContain("+0.5")

    const gd = findEntry("猎魔人", { huntGoodCount: 1 }, "误伤好人")
    expect(gd).toBeTruthy()
    expect(gd!.delta).toBe(-0.5)
    expect(SCORE_TEXT["猎魔人"]).toContain("-0.5")
  })

  it("狼美人：悍跳拿警徽 +0.5（自刀项不可达已移除）", () => {
    const han = findEntry("狼美人", { wolfHanTiaoJinghui: true }, "悍跳")
    expect(han).toBeTruthy()
    expect(han!.delta).toBe(0.5)
    expect(findEntry("狼美人", { wolfSelfKillCheat: true }, "自刀")).toBeUndefined()
    expectText("狼美人", "悍跳")
  })

  it("摄梦人：连梦击杀狼 +1、连梦击杀好人 -1", () => {
    const wk = findEntry("摄梦人", { dreamKillWolf: 1 }, "连梦击杀狼")
    expect(wk).toBeTruthy()
    expect(wk!.delta).toBe(1)
    expect(SCORE_TEXT["摄梦人"]).toContain("+1")

    const gd = findEntry("摄梦人", { dreamKillGood: 1 }, "连梦击杀好人")
    expect(gd).toBeTruthy()
    expect(gd!.delta).toBe(-1)
    expect(SCORE_TEXT["摄梦人"]).toContain("-1")
  })

  it("炸弹人：炸死狼 +1、炸死好人 -1、全票放逐独赢 +3", () => {
    const wk = findEntry("炸弹人", { bombWolfCount: 1 }, "炸狼")
    expect(wk).toBeTruthy()
    expect(wk!.delta).toBe(1)
    expect(SCORE_TEXT["炸弹人"]).toContain("+1")

    const gd = findEntry("炸弹人", { bombGoodCount: 1 }, "炸好人")
    expect(gd).toBeTruthy()
    expect(gd!.delta).toBe(-1)
    expect(SCORE_TEXT["炸弹人"]).toContain("-1")

    // 全票放逐独赢：需 winCamp=third + bombVictory=true
    const { st, p } = makeRoleState("炸弹人", {})
    st.winCamp = "third"
    st.bombVictory = true
    const entries = getRoleInstance("炸弹人")!.scoreRules(
      st,
      p as unknown as { name: string; role: string; mark: Record<string, unknown> },
    )
    const win = entries.find((e) => e.reason.includes("独赢"))
    expect(win, "缺少全票放逐独赢计分项").toBeTruthy()
    expect(win!.delta).toBe(4)
    expect(SCORE_TEXT["炸弹人"]).toContain("+4")
    expect(SCORE_TEXT["炸弹人"]).toContain("独赢")
  })

  it("野孩子：黑化变身 +1", () => {
    const tr = findEntry("野孩子", { isTransform: true }, "黑化变身")
    expect(tr).toBeTruthy()
    expect(tr!.delta).toBe(1)
    expectText("野孩子", "+1")
    expect(SCORE_TEXT["野孩子"]).toContain("变身")
  })

  it("隐狼：无独立动作分（scoreRules 返回空），文案仅胜利分", () => {
    const entries = entriesFor("隐狼", {})
    expect(entries, "隐狼不应有独立动作计分项").toEqual([])
    // 文案只含胜利分（不含任何 +/-N 动作分）
    const text = SCORE_TEXT["隐狼"]
    expect(text).toBeTruthy()
    // 文案只含胜利分，不含任何动作分项（如「XX+1」「XX-1」）
    expect(text).toBe("胜利+3")
    const actionScorePattern = /[\u4e00-\u9fa5]+[+-]\d/g
    const matches = text.match(actionScorePattern) ?? []
    expect(matches.every((m) => m === "胜利+3"), "隐狼文案不应含胜利分以外的动作计分").toBe(true)
  })
})

describe("新角色计分护栏：胜利分归属（防类别错配）", () => {
  it("GOD_LIST 含猎魔人/摄梦人（好人胜走神职+3），不含炸弹人/野孩子", () => {
    expect(GOD_LIST).toContain("猎魔人")
    expect(GOD_LIST).toContain("摄梦人")
    expect(GOD_LIST).not.toContain("炸弹人")
    expect(GOD_LIST).not.toContain("野孩子")
  })

  it("摄梦人好人胜：通用逻辑给神职 +3", () => {
    const st = defaultState()
    st.winCamp = "god"
    const dreamer = newPlayer("P1")
    dreamer.role = "摄梦人"
    const civ = newPlayer("P2")
    civ.role = "平民"
    st.players = [dreamer, civ]
    recalcScore(st)
    expect(dreamer.scoreRound).toBeGreaterThanOrEqual(3)
    expect(dreamer.scoreDetail).toContain("神职胜利+3")
  })

  it("隐狼狼胜：由 isEffectiveWolf 通用逻辑给 +3", () => {
    const st = defaultState()
    st.winCamp = "wolf"
    const hw = newPlayer("P1")
    hw.role = "隐狼"
    st.players = [hw]
    recalcScore(st)
    expect(hw.scoreDetail).toContain("狼人胜利+3")
  })

  it("炸弹人第三方胜：动作分 + 独赢+4（不叠加通用第三方+3）", () => {
    const st = defaultState()
    st.winCamp = "third"
    st.bombVictory = true
    const bomb = newPlayer("P1")
    bomb.role = "炸弹人"
    bomb.mark.bombWolfCount = 1
    st.players = [bomb]
    recalcScore(st)
    expect(bomb.scoreDetail).toContain("炸弹炸狼+1")
    expect(bomb.scoreDetail).toContain("全票放逐独赢+4")
    // 炸弹人的 +4 即其胜利分，不再叠加通用第三方胜利+3，避免重复计分
    expect(bomb.scoreDetail).not.toContain("第三方胜利+3")
    expect(bomb.scoreRound).toBeCloseTo(5, 5)
  })
})
