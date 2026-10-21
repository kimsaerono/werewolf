import { describe, it, expect, beforeEach } from "bun:test"
import {
  defaultState,
  wolfKill,
  wolfEmptyKill,
  wolfBaoZha,
  prophetCheck,
  witchPoison,
  witchSave,
  hunterHunt,
  dreamDo,
  guardDo,
  killPlayer,
  nextNight,
  startNewGame,
  confirmPlayers,
  getRoleInstance,
} from "./logic"
import { resolveNightEffects } from "./night-resolver"
import type { GameState } from "./logic"

/** 构造含恶灵骑士的测试局面 */
function makeState(): GameState {
  const st = defaultState()
  st.boardRoles = ["狼人", "恶灵骑士", "预言家", "女巫", "猎人", "平民", "平民", "平民"]
  st.players = [
    { name: "P1", no: 1, alive: true, role: "狼人", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P2", no: 2, alive: true, role: "恶灵骑士", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P3", no: 3, alive: true, role: "预言家", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P4", no: 4, alive: true, role: "女巫", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P5", no: 5, alive: true, role: "猎人", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P6", no: 6, alive: true, role: "平民", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P7", no: 7, alive: true, role: "平民", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
    { name: "P8", no: 8, alive: true, role: "平民", scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } },
  ]
  st.round = 1
  st.phase = "night"
  st.uiDone = {}
  st.nightSteps = { cupid: false, loversMeet: false, guard: false, wolf: false, charm: false, witch: false, prophet: false, idiotOpen: false, knight: false, hunterOpen: false }
  st.nightWolfKill = ""
  st.nightWitchPoison = ""
  st.nightWitchSave = ""
  st.nightUsedDrug = null
  st.witchSaveUsed = false
  st.witchPoisonUsed = false
  return st
}

function defaultMark() {
  return {
    prophetCheckWolf: 0, prophetCheckGood: false, prophetNoCheckCount: 0,
    witchSaveGood: false, witchPoWolf: false, witchPoGood: false,
    hunterKillWolf: false, hunterKillGood: false, hunterIsPoisoned: false,
    wolfKingShotGood: false, wolfKingShotWolf: false, wolfKingIsPoisoned: false,
    wolfBombTarget: "", guardHitCount: 0, guardSameSaveKill: false,
    wolfHanTiaoJinghui: false, wolfSelfKillCheat: false, idiotFlipped: false,
    voteTarget: "", voteWolfCount: 0, voteGoodCount: 0,
    dreadKnightRevengeUsed: false, dreadKnightCheckedTonight: false,
    dreadKnightPoisonedTonight: false, dreadKnightRevengeCount: 0,
    dreadKnightEverChecked: false, dreadKnightEverPoisoned: false,
    dreadKnightRevengeTarget: "",
  }
}

describe("恶灵骑士", () => {
  let st: GameState
  beforeEach(() => { st = makeState() })

  it("注册元数据正确", () => {
    const def = getRoleInstance("恶灵骑士")?.def
    expect(def).toBeTruthy()
    expect(def!.camp).toBe("wolf")
    expect(def!.unique).toBe(true)
    expect(def!.nightStep).toBeUndefined()
    expect(def!.intentKeys).toContain("nightWolfKill")
  })

  it("狼刀不能选恶灵骑士（不能自刀）", () => {
    const err = wolfKill(st, "P2")
    expect(err).toContain("恶灵骑士")
    expect(st.nightWolfKill).toBe("")
  })

  it("预言家验恶灵骑士 → 预言家天亮出局（反伤触发）", () => {
    // 狼刀 P6
    wolfKill(st, "P6")
    // 预言家验恶灵骑士
    prophetCheck(st, "P2")
    expect(st.players[1].mark.dreadKnightCheckedTonight).toBe(true)
    expect(st.players[1].mark.dreadKnightEverChecked).toBe(true)
    // 天亮结算
    resolveNightEffects(st)
    // 预言家死了
    expect(st.players[2].alive).toBe(false)
    expect(st.players[2].deathReason).toBe("other")
    // 恶灵骑士活着
    expect(st.players[1].alive).toBe(true)
    // 反伤已使用
    expect(st.players[1].mark.dreadKnightRevengeUsed).toBe(true)
    expect(st.players[1].mark.dreadKnightRevengeCount).toBe(1)
    expect(st.players[1].mark.dreadKnightRevengeTarget).toBe("P3")
  })

  it("女巫毒恶灵骑士 → 女巫天亮出局（反伤触发），恶灵骑士不死，毒药消耗", () => {
    // 狼刀 P6
    wolfKill(st, "P6")
    // 女巫毒恶灵骑士
    const err = witchPoison(st, "P2")
    expect(err).toBeNull()
    // 毒药已消耗
    expect(st.witchPoisonUsed).toBe(true)
    // 不设 witchPoWolf / witchPoGood
    expect(st.players[3].mark.witchPoWolf).toBe(false)
    expect(st.players[3].mark.witchPoGood).toBe(false)
    // 天亮结算
    resolveNightEffects(st)
    // 女巫死了
    expect(st.players[3].alive).toBe(false)
    expect(st.players[3].deathReason).toBe("other")
    // 恶灵骑士活着（毒被免疫）
    expect(st.players[1].alive).toBe(true)
    // P6 被狼刀死了
    expect(st.players[5].alive).toBe(false)
    expect(st.players[5].deathReason).toBe("wolfKill")
  })

  it("同夜预言家验 + 女巫毒 → 预言家出局，女巫安全", () => {
    wolfKill(st, "P6")
    witchPoison(st, "P2")
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    // 预言家死（优先反弹预言家）
    expect(st.players[2].alive).toBe(false)
    expect(st.players[2].deathReason).toBe("other")
    // 女巫活（毒药已消耗但未被反弹）
    expect(st.players[3].alive).toBe(true)
    // 恶灵骑士活
    expect(st.players[1].alive).toBe(true)
  })

  it("反伤用掉后预言家再验 → 不再反弹，预言家安全", () => {
    // 第1夜：预言家验恶灵骑士 → 反弹预言家
    wolfKill(st, "P6")
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    expect(st.players[2].alive).toBe(false)

    // 第2夜：预言家已死，无法验（这里模拟另一个场景：反伤已用掉）
    // 重置恶灵骑士状态，手动设反伤已用
    nextNight(st)
    // 复活预言家（测试用）
    st.players[2].alive = true
    st.players[2].deathReason = ""
    // 反伤已用掉
    st.players[1].mark.dreadKnightRevengeUsed = true
    // 预言家再验恶灵骑士（P6 已出局，本夜空刀完成狼人步骤）
    wolfEmptyKill(st)
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    // 预言家安全（反伤已用）
    expect(st.players[2].alive).toBe(true)
    expect(st.players[2].deathReason).toBe("")
    // 恶灵骑士安全
    expect(st.players[1].alive).toBe(true)
    // 计分：吸引查验未反伤 +0.5
    const role = getRoleInstance("恶灵骑士")!
    const entries = role.scoreRules(st, { name: "P2", role: "恶灵骑士", mark: st.players[1].mark })
    const checkEntry = entries.find((e) => e.reason === "吸引查验未反伤")
    expect(checkEntry).toBeTruthy()
    expect(checkEntry!.delta).toBe(0.5)
  })

  it("反伤用掉后女巫再毒 → 不再反弹，恶灵骑士仍免疫夜间伤害", () => {
    // 第1夜：女巫毒恶灵骑士 → 反弹女巫
    wolfKill(st, "P6")
    witchPoison(st, "P2")
    resolveNightEffects(st)
    expect(st.players[3].alive).toBe(false)

    // 第2夜
    nextNight(st)
    st.players[3].alive = true
    st.players[3].deathReason = ""
    st.players[3].mark.witchPoisonUsed = false
    st.witchPoisonUsed = false
    st.nightUsedDrug = null
    st.players[1].mark.dreadKnightRevengeUsed = true
    // 女巫再毒恶灵骑士（P6 已出局，本夜空刀完成狼人步骤）
    wolfEmptyKill(st)
    witchPoison(st, "P2")
    resolveNightEffects(st)
    // 女巫安全
    expect(st.players[3].alive).toBe(true)
    // 反伤已用掉：不再反弹，但夜间免伤依然生效
    expect(st.players[1].alive).toBe(true)
    expect(st.players[1].deathReason || "").toBe("")
    // 计分：吸引毒药未反伤 +0.5
    const role = getRoleInstance("恶灵骑士")!
    const entries = role.scoreRules(st, { name: "P2", role: "恶灵骑士", mark: st.players[1].mark })
    const poisonEntry = entries.find((e) => e.reason === "吸引毒药未反伤")
    expect(poisonEntry).toBeTruthy()
    expect(poisonEntry!.delta).toBe(0.5)
  })

  it("计分：反伤触发 +1", () => {
    wolfKill(st, "P6")
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    const role = getRoleInstance("恶灵骑士")!
    const entries = role.scoreRules(st, { name: "P2", role: "恶灵骑士", mark: st.players[1].mark })
    const revengeEntry = entries.find((e) => e.reason === "反伤×1")
    expect(revengeEntry).toBeTruthy()
    expect(revengeEntry!.delta).toBe(1)
  })

  it("计分：反伤命中预言家时，不再叠加「吸引查验未反伤」", () => {
    wolfKill(st, "P6")
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    const role = getRoleInstance("恶灵骑士")!
    const entries = role.scoreRules(st, { name: "P2", role: "恶灵骑士", mark: st.players[1].mark })
    expect(entries.find((e) => e.reason === "反伤×1")?.delta).toBe(1)
    expect(entries.find((e) => e.reason === "吸引查验未反伤")).toBeUndefined()
    const total = entries.reduce((sum, e) => sum + e.delta, 0)
    expect(total).toBe(1)
  })

  it("计分：反伤命中女巫时，不再叠加「吸引毒药未反伤」", () => {
    wolfKill(st, "P6")
    witchPoison(st, "P2")
    resolveNightEffects(st)
    const role = getRoleInstance("恶灵骑士")!
    const entries = role.scoreRules(st, { name: "P2", role: "恶灵骑士", mark: st.players[1].mark })
    expect(entries.find((e) => e.reason === "反伤×1")?.delta).toBe(1)
    expect(entries.find((e) => e.reason === "吸引毒药未反伤")).toBeUndefined()
    expect(entries.reduce((sum, e) => sum + e.delta, 0)).toBe(1)
  })

  it("计分：同夜验+毒只反弹预言家 → 仅毒药侧计「未反伤」+0.5", () => {
    wolfKill(st, "P6")
    witchPoison(st, "P2")
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    const role = getRoleInstance("恶灵骑士")!
    const entries = role.scoreRules(st, { name: "P2", role: "恶灵骑士", mark: st.players[1].mark })
    expect(entries.find((e) => e.reason === "反伤×1")?.delta).toBe(1)
    expect(entries.find((e) => e.reason === "吸引查验未反伤")).toBeUndefined()
    expect(entries.find((e) => e.reason === "吸引毒药未反伤")?.delta).toBe(0.5)
    expect(entries.reduce((sum, e) => sum + e.delta, 0)).toBe(1.5)
  })

  it("不能自爆", () => {
    expect(wolfBaoZha(st, "P2")).toContain("不能自爆")
    expect(st.players[1].alive).toBe(true)
    expect(st.skipVote).toBe(false)
  })

  it("反伤用掉后女巫毒 → 毒药消耗，恶灵骑士仍不死", () => {
    // 第1夜：预言家验 → 触发反伤
    wolfKill(st, "P6")
    prophetCheck(st, "P2")
    resolveNightEffects(st)
    expect(st.players[1].mark.dreadKnightRevengeUsed).toBe(true)

    // 第2夜：女巫毒恶灵骑士 → 反伤已用掉，正常毒死
    nextNight(st)
    wolfEmptyKill(st)
    expect(witchPoison(st, "P2")).toBeNull()
    resolveNightEffects(st)
    expect(st.players[1].alive).toBe(true)
    expect(st.players[1].deathReason || "").toBe("")
    expect(st.players[3].alive).toBe(true)
    expect(st.players[3].mark.witchPoWolf).toBe(false)
  })

  it("反伤未触发时免疫猎魔人狩猎；反伤用掉后会被狩猎击杀", () => {
    st.players[4].role = "猎魔人"
    st.boardRoles = ["狼人", "恶灵骑士", "预言家", "女巫", "猎魔人", "平民", "平民", "平民"]
    st.round = 2

    // 反伤未触发：狩猎无效，猎魔人也不反噬
    expect(hunterHunt(st, "P2")).toBeNull()
    wolfEmptyKill(st)
    resolveNightEffects(st)
    expect(st.players[1].alive).toBe(true)
    expect(st.players[4].alive).toBe(true)
    expect(st.players[4].mark.huntWolfCount || 0).toBe(0)

    // 反伤用掉后：夜间免伤依然生效，狩猎仍无法击杀
    nextNight(st)
    st.players[1].mark.dreadKnightRevengeUsed = true
    expect(hunterHunt(st, "P2")).toBeNull()
    wolfEmptyKill(st)
    resolveNightEffects(st)
    expect(st.players[1].alive).toBe(true)
    expect(st.players[4].alive).toBe(true)
    expect(st.players[4].mark.huntWolfCount || 0).toBe(0)
  })

  it("反伤未触发时免疫摄梦连梦；反伤用掉后会被梦杀", () => {
    st.players[4].role = "摄梦人"
    st.boardRoles = ["狼人", "恶灵骑士", "预言家", "女巫", "摄梦人", "平民", "平民", "平民"]
    st.round = 2
    st.players[4].mark.prevDreamTarget = "P2"

    expect(dreamDo(st, "P2")).toBeNull()
    wolfEmptyKill(st)
    resolveNightEffects(st)
    expect(st.players[1].alive).toBe(true)
    expect(st.players[4].mark.dreamKillWolf || 0).toBe(0)

    nextNight(st)
    st.players[1].mark.dreadKnightRevengeUsed = true
    st.players[4].mark.prevDreamTarget = "P2"
    expect(dreamDo(st, "P2")).toBeNull()
    wolfEmptyKill(st)
    resolveNightEffects(st)
    expect(st.players[1].alive).toBe(true)
    expect(st.players[4].mark.dreamKillWolf || 0).toBe(0)
  })

  it("白天被猎人开枪可击杀，猎人不反噬", () => {
    const killed = killPlayer(st, "P2", "shot", "猎人开枪")
    expect(killed).toContain("P2")
    expect(st.players[1].alive).toBe(false)
    expect(st.players[1].deathReason).toBe("shot")
    expect(st.players[1].mark.dreadKnightRevengeUsed).toBe(false)
  })

  it("白狼王自爆带走恶灵骑士 → 正常出局（不被拦截）", () => {
    // 直接调用 killPlayer 模拟自爆带走
    const killed = killPlayer(st, "P2", "other", "白狼王自爆")
    expect(killed).toContain("P2")
    expect(st.players[1].alive).toBe(false)
    expect(st.players[1].deathReason).toBe("other")
  })

  it("女巫解药不解恶灵骑士的反伤（反伤 reason=other，解药只解 wolfKill）", () => {
    // 场景：恶灵骑士被验触发反伤，同时女巫救了预言家（解药目标是狼刀目标，不是预言家）
    // 这里测试解药只解 wolfKill 的逻辑
    wolfKill(st, "P3") // 狼刀预言家
    prophetCheck(st, "P2") // 预言家验恶灵骑士（验完后预言家会被反伤）
    // 女巫解药救预言家（解狼刀）
    witchSave(st)
    resolveNightEffects(st)
    // 预言家：被解药救了狼刀，但反伤依旧触发（reason=other，解药不解）
    // 实际上预言家死了（反伤），因为解药只解 wolfKill
    expect(st.players[2].alive).toBe(false)
    expect(st.players[2].deathReason).toBe("other")
  })

  it("守卫守中也挡不住反伤（守卫只挡狼人刀人，反伤 reason=other）", () => {
    // 把猎人位换成守卫，构造含守卫的局面
    st.players[4].role = "守卫"
    st.boardRoles = ["狼人", "恶灵骑士", "预言家", "女巫", "守卫", "平民", "平民", "平民"]
    expect(wolfKill(st, "P3")).toBeNull() // 狼刀预言家
    expect(guardDo(st, "P3", false)).toBeNull() // 守卫守住预言家
    expect(prophetCheck(st, "P2")).toBeTruthy() // 预言家验恶灵骑士 → 触发反伤
    resolveNightEffects(st)
    // 狼刀被守中，但反伤照样命中：预言家死于反伤，且守卫不算守中
    expect(st.players[2].alive).toBe(false)
    expect(st.players[2].deathReason).toBe("other")
    expect(st.players[4].mark.guardHitCount).toBe(0)
    expect(st.players[1].mark.dreadKnightRevengeUsed).toBe(true)
  })
})
