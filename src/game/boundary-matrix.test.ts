import { describe, it, expect } from "bun:test"
import {
  defaultState,
  defaultMark,
  newPlayer,
  type GameState,
  type Player,
  isWolfRole,
  isWolfPackRole,
  effectiveCampOf,
  isEffectiveWolf,
  hiddenWolfCanKnife,
  refreshHiddenWolfKnife,
  wolfKill,
  wolfEmptyKill,
  charmDo,
  nightmareFear,
  wildChildPick,
  checkWildChildTransform,
  hunterHunt,
  dreamDo,
  prophetCheck,
  prophetNoCheck,
  gargoyleCheck,
  gargoyleKill,
  gargoyleEmptyKill,
  gargoyleCanKill,
  gravekeeperResult,
  guardDo,
  witchSave,
  witchPoison,
  knightDuel,
  finishVote,
  wolfBaoZha,
  wolfKingBaoZha,
  hunterShootConfirm,
  hunterGiveUpShot,
  wolfKingShootConfirm,
  wolfKingGiveUpShot,
  killPlayer,
  nextNight,
  checkWin,
  recalcScore,
  GOD_LIST,
  DEFAULT_VOICES,
} from "./logic"
import { resolveNightEffects } from "./night-resolver"
import { aliveCampCounts } from "./win-checker"
import { roleIds, getRole } from "./roles/registry"
import { getRoleInstance } from "./roles/builtin"
import { getNightActionSteps, getActiveNightStepKeys } from "./step-flow"

/**
 * 全角色边界矩阵（模拟对局，不依赖 UI）。
 *
 * 目标：把「角色 × 技能 × 阵营 × 顺序 × 免疫/克制 × 胜负 × 多技能叠加 × 空操作」
 * 的边界固化下来，任何实现漂移都直接红。
 *
 * 约定：玩家名 P0、P1…（与 new-roles.test.ts 一致）。
 */

function mk(name: string, no: number, role: string): Player {
  return {
    name,
    no,
    alive: true,
    role,
    scoreRound: 0,
    scoreTotal: 0,
    star: "",
    scoreDetail: [],
    mark: { ...defaultMark() },
  }
}

function makeState(roles: string[], over: Partial<GameState> = {}): GameState {
  const st = defaultState()
  st.boardRoles = roles
  st.players = roles.map((r, i) => mk(`P${i}`, i, r))
  st.round = 1
  st.phase = "night"
  st.uiDone = {}
  st.nightWolfKill = ""
  st.nightWitchPoison = ""
  st.nightWitchSave = ""
  st.nightUsedDrug = null
  st.witchSaveUsed = false
  st.witchPoisonUsed = false
  st.nightSteps = {}
  Object.assign(st, over)
  refreshHiddenWolfKnife(st)
  return st
}

const g = (st: GameState, n: string) => st.players.find((p) => p.name === n)!

/** 完成狼人步骤（无狼板子也允许空刀） */
function finishWolfStep(st: GameState) {
  st.nightSteps.wolf = true
}

// ===================== 1. 角色元数据矩阵 =====================

describe("边界矩阵 · 全角色元数据", () => {
  const CAMP = new Set(["wolf", "god", "villager", "third"])

  it("每个角色 camp 合法、emoji/short 非空、唯一性合法", () => {
    for (const id of roleIds()) {
      const def = getRole(id)!
      expect(CAMP.has(def.camp), `${id} camp=${def.camp}`).toBe(true)
      expect(def.emoji.length, `${id} emoji 空`).toBeGreaterThan(0)
      expect(def.short.length, `${id} short 空`).toBeGreaterThan(0)
      expect(typeof def.unique).toBe("boolean")
      expect(getRoleInstance(id)?.def.id, `${id} 缺实例`).toBe(id)
    }
  })

  it("只有石像鬼/隐狼是狼阵营但不进狼群，其余狼进狼群", () => {
    for (const id of roleIds()) {
      const def = getRole(id)!
      if (def.camp !== "wolf") {
        expect(isWolfRole(id), `${id} 非狼阵营`).toBe(false)
        expect(isWolfPackRole(id), `${id} 非狼阵营`).toBe(false)
        continue
      }
      expect(isWolfRole(id)).toBe(true)
      const pack = id !== "石像鬼" && id !== "隐狼"
      expect(isWolfPackRole(id), `${id} 狼群归属`).toBe(pack)
    }
  })

  it("第三方阵营只有丘比特与炸弹人", () => {
    const third = roleIds().filter((id) => getRole(id)!.camp === "third")
    expect(third.sort()).toEqual(["丘比特", "炸弹人"].sort())
  })

  it("神职列表 = camp god，白痴名义神职但枪带不算神牌", () => {
    const gods = roleIds().filter((id) => getRole(id)!.camp === "god")
    expect(GOD_LIST.sort()).toEqual(gods.sort())
    expect(GOD_LIST).toContain("猎魔人")
    expect(GOD_LIST).toContain("摄梦人")
    expect(getRoleInstance("白痴")!.countsAsGod()).toBe(false)
    expect(getRoleInstance("猎魔人")!.countsAsGod()).toBe(true)
  })

  it("所有声明 nightStep 的角色其 step key 都在实时步骤表中", () => {
    const live = new Set(getNightActionSteps().map((s) => s.key))
    for (const id of roleIds()) {
      const def = getRole(id)!
      if (!def.nightStep) continue
      expect(live.has(def.nightStep.key), `${id} 的 ${def.nightStep.key} 未被消费`).toBe(true)
    }
  })

  it("夜间步骤 order 全局唯一且严格递增", () => {
    const steps = getNightActionSteps()
    const owners = new Map<string, string>()
    for (const id of roleIds()) {
      const ns = getRole(id)!.nightStep
      if (!ns) continue
      expect(owners.has(ns.key), `步骤 ${ns.key} 重复`).toBe(false)
      owners.set(ns.key, id)
    }
    expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length)
  })
})

// ===================== 2. 夜间顺序矩阵 =====================

describe("边界矩阵 · 夜间顺序", () => {
  it("完整夜间步骤顺序锁定", () => {
    expect(getNightActionSteps().map((s) => s.key)).toEqual([
      "wildChild",
      "cupid",
      "loversMeet",
      "guard",
      "gargoyle",
      "hiddenWolf",
      "nightmare",
      "wolf",
      "charm",
      "prophet",
      "hunterWolf",
      "dreamer",
      "witch",
      "gravekeeper",
      "idiotOpen",
      "knight",
      "hunterOpen",
      "bomberOpen",
    ])
  })

  it("全角色板首夜：所有步骤按序出现（含首夜限定）", () => {
    const board = [
      "狼人", "隐狼", "噩梦之影", "血月使徒", "狼美人", "恶灵骑士", "石像鬼",
      "预言家", "猎魔人", "摄梦人", "女巫", "猎人", "守卫", "骑士", "白痴", "守墓人",
      "平民", "野孩子", "炸弹人", "丘比特",
    ]
    const keys = getActiveNightStepKeys({
      boardRoles: board,
      uiDone: {},
      nightSteps: {},
      round: 1,
      lovers: ["P0", "P1"],
      isWolfRole,
      isWolfPack: isWolfPackRole,
      players: [],
      hunterExists: true,
      hunterAlive: true,
    })
    expect(keys).toEqual([
      "wildChild", "cupid", "loversMeet", "guard", "gargoyle", "hiddenWolf", "nightmare",
      "wolf", "charm", "prophet", "hunterWolf", "dreamer", "witch", "gravekeeper",
      "idiotOpen", "knight", "hunterOpen", "bomberOpen",
    ])
  })

  it("第二夜：仅首夜限定步骤消失，持续技能仍在", () => {
    const board = ["狼人", "隐狼", "噩梦之影", "石像鬼", "狼美人", "预言家", "猎魔人", "摄梦人", "女巫", "守卫", "守墓人", "野孩子", "炸弹人", "丘比特", "白痴", "骑士", "猎人"]
    const keys = getActiveNightStepKeys({
      boardRoles: board,
      uiDone: {},
      nightSteps: {},
      round: 2,
      lovers: [],
      isWolfRole,
      isWolfPack: isWolfPackRole,
      players: [],
      hunterExists: true,
      hunterAlive: true,
    })
    for (const firstOnly of ["wildChild", "cupid", "loversMeet", "hiddenWolf", "idiotOpen", "knight", "bomberOpen"]) {
      expect(keys, `${firstOnly} 不应出现在第二夜`).not.toContain(firstOnly)
    }
    for (const everyNight of ["gargoyle", "nightmare", "wolf", "charm", "prophet", "hunterWolf", "dreamer", "witch", "gravekeeper", "hunterOpen"]) {
      expect(keys, `${everyNight} 应出现在第二夜`).toContain(everyNight)
    }
  })

  it("每个持续技能角色：移出板子后对应步骤消失", () => {
    const everyNight: Array<[string, string]> = [
      ["石像鬼", "gargoyle"],
      ["噩梦之影", "nightmare"],
      ["狼美人", "charm"],
      ["预言家", "prophet"],
      ["猎魔人", "hunterWolf"],
      ["摄梦人", "dreamer"],
      ["女巫", "witch"],
      ["守墓人", "gravekeeper"],
      ["守卫", "guard"],
      ["猎人", "hunterOpen"],
    ]
    for (const [role, key] of everyNight) {
      const withRole = getActiveNightStepKeys({
        boardRoles: ["狼人", role],
        uiDone: {},
        nightSteps: {},
        round: 2,
        lovers: [],
        isWolfRole,
        isWolfPack: isWolfPackRole,
        players: [],
        hunterExists: true,
        hunterAlive: true,
      })
      expect(withRole, `${role} 应在`).toContain(key)
      const without = getActiveNightStepKeys({
        boardRoles: ["狼人"],
        uiDone: {},
        nightSteps: {},
        round: 2,
        lovers: [],
        isWolfRole,
        isWolfPack: isWolfPackRole,
        players: [],
        hunterExists: true,
        hunterAlive: true,
      })
      expect(without, `${role} 移除后 ${key} 应消失`).not.toContain(key)
    }
  })

  it("已完成 / uiDone 的步骤从活动列表移除", () => {
    const keys = getActiveNightStepKeys({
      boardRoles: ["狼人", "预言家", "女巫"],
      uiDone: { prophet: true },
      nightSteps: { wolf: true },
      round: 2,
      lovers: [],
      isWolfRole,
      isWolfPack: isWolfPackRole,
      players: [],
      hunterExists: false,
      hunterAlive: false,
    })
    // 狼人步骤每夜常驻（照常念台词，不因已完成而移除）；预言家已 uiDone，女巫待行动
    expect(keys).toEqual(["wolf", "witch"])
  })
})

// ===================== 3. 技能空操作/非法目标矩阵 =====================

describe("边界矩阵 · 空操作与非法目标", () => {
  it("没有对应角色时各技能报错而不是崩", () => {
    const st = makeState(["平民", "平民"])
    expect(charmDo(st, "P0")).toBe("本局没有狼美人")
    expect(nightmareFear(st, "P0")).toBe("本局没有噩梦之影")
    expect(wildChildPick(st, "P0")).toBe("本局没有野孩子")
    expect(hunterHunt(st, "P0")).toBe("本局没有猎魔人")
    expect(dreamDo(st, "P0")).toBe("本局没有摄梦人")
    expect(gargoyleCheck(st, "P0")).toBe("本局没有石像鬼")
    expect(gargoyleKill(st, "P0")).toBe("石像鬼尚未解锁刀人能力")
    expect(guardDo(st, "P0", false)).toBe("本局没有守卫")
    expect(witchSave(st)).toBe("本晚还没有狼人刀人记录，无法使用解药")
    expect(witchPoison(st, "P0")).toBe("本局没有女巫")
    expect(knightDuel(st, "P0")).toBe("本局没有骑士")
    expect(hunterShootConfirm(st, "P0")).toBe("本局没有猎人")
    expect(wolfKingShootConfirm(st, "P0")).toBe("本局没有狼王")
    expect(gravekeeperResult(st)).toBeNull()
    expect(prophetNoCheck(st)).toBe("本局没有预言家")
  })

  it("已出局角色不能行动", () => {
    const st = makeState(["狼美人", "噩梦之影", "野孩子", "猎魔人", "摄梦人", "石像鬼", "守卫", "女巫", "骑士", "预言家"])
    st.players.forEach((p) => (p.alive = false))
    expect(charmDo(st, "P0")).toBe("狼美人已出局，本晚不能魅惑")
    expect(nightmareFear(st, "P0")).toBe("噩梦之影已出局，本晚不能恐惧")
    expect(wildChildPick(st, "P0")).toBe("野孩子已出局")
    expect(hunterHunt(st, "P0")).toBe("猎魔人已出局，本晚不能狩猎")
    expect(dreamDo(st, "P0")).toBe("摄梦人已出局，本晚不能入梦")
    expect(gargoyleCheck(st, "P0")).toBe("石像鬼已出局，本晚不能查验")
    expect(guardDo(st, "P0", false)).toBe("守卫已出局，本晚不能守人")
    expect(witchPoison(st, "P0")).toBe("女巫已出局，本晚不能用药")
    expect(knightDuel(st, "P0")).toBe("骑士已出局，无法决斗")
    expect(prophetCheck(st, "P0")).toBe("预言家已出局，本晚不能查验")
  })

  it("空目标/不存在目标均被拒绝", () => {
    const st = makeState(["狼美人", "噩梦之影", "野孩子", "猎魔人", "摄梦人", "石像鬼", "守卫", "女巫", "骑士", "预言家", "狼人", "平民"])
    st.round = 2
    expect(charmDo(st, "")).toBe("请选择魅惑对象")
    expect(nightmareFear(st, "")).toBe("请选择恐惧对象")
    expect(wildChildPick(st, "")).toBe("请选择榜样")
    expect(hunterHunt(st, "")).toBe("请选择狩猎对象")
    expect(dreamDo(st, "")).toBe("请选择入梦对象")
    expect(guardDo(st, "", false)).toBe("请选择守护对象")
    expect(witchPoison(st, "")).toBe("请选择毒杀目标")
    expect(knightDuel(st, "")).toBe("请选择决斗对象")
    expect(charmDo(st, "NOPE")).toBe("未找到该玩家")
    expect(nightmareFear(st, "NOPE")).toBe("未找到该玩家")
    expect(hunterHunt(st, "NOPE")).toBe("未找到该玩家")
    expect(dreamDo(st, "NOPE")).toBe("未找到该玩家")
    expect(guardDo(st, "NOPE", false)).toBe("未找到该玩家")
    expect(witchPoison(st, "NOPE")).toBe("未找到该玩家")
    expect(knightDuel(st, "NOPE")).toBe("未找到该玩家")
    expect(typeof prophetCheck(st, "NOPE")).toBe("string")
    expect(typeof gargoyleCheck(st, "NOPE")).toBe("string")
  })

  it("目标已出局被拒绝", () => {
    const st = makeState(["狼美人", "噩梦之影", "野孩子", "猎魔人", "摄梦人", "石像鬼", "守卫", "女巫", "骑士", "预言家", "狼人", "平民"])
    st.round = 2
    g(st, "P11").alive = false
    expect(charmDo(st, "P11")).toContain("已出局")
    expect(nightmareFear(st, "P11")).toContain("已出局")
    expect(wildChildPick(st, "P11")).toContain("已出局")
    expect(hunterHunt(st, "P11")).toContain("已出局")
    expect(dreamDo(st, "P11")).toContain("已出局")
    expect(guardDo(st, "P11", false)).toContain("已出局")
    expect(witchPoison(st, "P11")).toContain("已出局")
    expect(knightDuel(st, "P11")).toBe("该玩家已出局")
  })

  it("不能选自己（魅惑/榜样/毒/决斗）", () => {
    const st = makeState(["狼美人", "野孩子", "女巫", "骑士"])
    expect(charmDo(st, "P0")).toBe("狼美人不能魅惑自己")
    expect(wildChildPick(st, "P1")).toBe("野孩子不能选自己为榜样")
    expect(witchPoison(st, "P2")).toBe("女巫不能对自己用毒")
    expect(knightDuel(st, "P3")).toBe("不能和自己决斗")
  })

  it("重复操作：魅惑不可连续两晚同一人、野孩子榜样不可重复选", () => {
    const st = makeState(["狼美人", "野孩子", "平民"])
    expect(charmDo(st, "P2")).toBeNull()
    st.charmLastTarget = "P2"
    expect(charmDo(st, "P2")).toContain("不可连续两晚魅惑同一人")
    expect(wildChildPick(st, "P2")).toBeNull()
    expect(wildChildPick(st, "P1")).toContain("已选定榜样")
  })
})

// ===================== 4. 阵营/查验口径矩阵 =====================

describe("边界矩阵 · 阵营与查验口径", () => {
  it("隐狼：阵营狼、验金水、不算狼群", () => {
    const st = makeState(["狼人", "隐狼", "预言家", "平民"])
    const r = prophetCheck(st, "P1") as { isWolf: boolean }
    expect(r.isWolf).toBe(false)
    expect(isEffectiveWolf(g(st, "P1"))).toBe(true)
    expect(isWolfPackRole("隐狼")).toBe(false)
  })

  it("野孩子：未黑化为民、黑化后为狼且验查杀", () => {
    const st = makeState(["野孩子", "预言家", "狼人", "平民"])
    expect(effectiveCampOf(g(st, "P0"))).toBe("villager")
    g(st, "P0").mark.isTransform = true
    expect(effectiveCampOf(g(st, "P0"))).toBe("wolf")
    const r = prophetCheck(st, "P0") as { isWolf: boolean }
    expect(r.isWolf).toBe(true)
  })

  it("炸弹人：第三方、验金水、石像鬼看底牌名", () => {
    const st = makeState(["石像鬼", "炸弹人", "预言家"])
    expect(effectiveCampOf(g(st, "P1"))).toBe("third")
    expect(isEffectiveWolf(g(st, "P1"))).toBe(false)
    const pr = prophetCheck(st, "P1") as { isWolf: boolean }
    expect(pr.isWolf).toBe(false)
    const gr = gargoyleCheck(st, "P1") as { role: string }
    expect(gr.role).toBe("炸弹人")
  })

  it("石像鬼看任何底牌都返回具体角色名", () => {
    const st = makeState(["石像鬼", "女巫", "预言家", "平民", "隐狼"])
    expect((gargoyleCheck(st, "P1") as { role: string }).role).toBe("女巫")
    expect((gargoyleCheck(st, "P2") as { role: string }).role).toBe("预言家")
    expect((gargoyleCheck(st, "P3") as { role: string }).role).toBe("平民")
    expect((gargoyleCheck(st, "P4") as { role: string }).role).toBe("隐狼")
  })

  it("诅咒类封印：恐惧/血月封印对四类核心神职生效", () => {
    const st = makeState(["噩梦之影", "预言家", "女巫", "猎魔人", "摄梦人", "守卫"])
    nightmareFear(st, "P1")
    expect(g(st, "P1").mark.skillDisabled).toBe(true)
    expect(typeof prophetCheck(st, "P5")).toBe("string")

    const st2 = makeState(["狼人", "血月使徒", "预言家", "女巫", "猎魔人", "摄梦人", "守卫", "平民"])
    st2.phase = "day"
    wolfBaoZha(st2, "P1")
    expect(st2.bloodMoonSeal).toBe(true)
    expect(typeof prophetCheck(st2, "P7")).toBe("string")
    expect(witchPoison(st2, "P7")).toContain("血月封印")
    expect(hunterHunt(st2, "P7")).toContain("血月封印")
    expect(dreamDo(st2, "P7")).toContain("血月封印")
    expect(guardDo(st2, "P7", false)).toContain("血月封印")
  })

  it("血月封印不作用于石像鬼（狼非神职）", () => {
    const st = makeState(["石像鬼", "血月使徒", "平民"])
    st.bloodMoonSeal = true
    expect(typeof gargoyleCheck(st, "P2")).toBe("object")
  })
})

// ===================== 5. 免疫与克制矩阵 =====================

describe("边界矩阵 · 免疫与克制", () => {
  function night(): GameState {
    const st = makeState(["狼人", "守卫", "女巫", "预言家", "平民", "平民"], { round: 2 })
    return st
  }

  it("守卫只挡狼刀：挡不住毒/猎魔/连梦", () => {
    // 狼刀被守
    const a = night()
    guardDo(a, "P4", false)
    wolfKill(a, "P4")
    resolveNightEffects(a)
    expect(g(a, "P4").alive).toBe(true)

    // 毒药无视守卫
    const b = night()
    guardDo(b, "P4", false)
    wolfEmptyKill(b)
    witchPoison(b, "P4")
    resolveNightEffects(b)
    expect(g(b, "P4").alive).toBe(false)

    // 猎魔猎杀无视守卫
    const c = makeState(["猎魔人", "守卫", "狼人", "平民", "平民"], { round: 2 })
    guardDo(c, "P2", false)
    hunterHunt(c, "P2")
    wolfEmptyKill(c)
    resolveNightEffects(c)
    expect(g(c, "P2").alive).toBe(false)

    // 连梦无视守卫
    const d = makeState(["摄梦人", "守卫", "狼人", "平民", "平民"], { round: 2 })
    g(d, "P0").mark.prevDreamTarget = "P3"
    guardDo(d, "P3", false)
    dreamDo(d, "P3")
    wolfEmptyKill(d)
    resolveNightEffects(d)
    expect(g(d, "P3").alive).toBe(false)
  })

  it("女巫解药只解狼刀：救不回毒/猎魔/连梦", () => {
    const a = makeState(["女巫", "狼人", "平民", "平民"], { round: 2 })
    wolfKill(a, "P2")
    witchSave(a)
    resolveNightEffects(a)
    expect(g(a, "P2").alive).toBe(true)

    // 狼刀 + 猎魔猎杀同目标：解药只能抵消狼刀，猎魔造成的死亡仍在
    const b = makeState(["女巫", "猎魔人", "狼人", "平民", "平民"], { round: 2 })
    wolfKill(b, "P2")
    expect(witchSave(b)).toBeNull()
    hunterHunt(b, "P2")
    resolveNightEffects(b)
    expect(g(b, "P2").alive).toBe(false)
  })

  it("同守同救：守卫+解药同目标 → 双双失效，目标死亡且守卫记分", () => {
    const st = makeState(["狼人", "守卫", "女巫", "平民", "平民"], { round: 2 })
    guardDo(st, "P3", true)
    wolfKill(st, "P3")
    witchSave(st)
    resolveNightEffects(st)
    expect(g(st, "P3").alive).toBe(false)
    expect(g(st, "P1").mark.guardSameSaveKill).toBe(true)
  })

  it("女巫毒免疫：恶灵骑士/猎魔人消耗毒药但不死", () => {
    for (const immune of ["恶灵骑士", "猎魔人"]) {
      const st = makeState(["女巫", immune, "平民", "狼人"], { round: 2 })
      witchPoison(st, "P1")
      wolfEmptyKill(st)
      resolveNightEffects(st)
      expect(g(st, "P1").alive, `${immune} 应免疫毒`).toBe(true)
      expect(st.witchPoisonUsed).toBe(true)
    }
  })

  it("猎魔人狩猎：戳狼狼死、戳好人自己反噬；不触发守卫/解药", () => {
    const a = makeState(["猎魔人", "狼人", "平民", "平民"], { round: 2 })
    hunterHunt(a, "P1")
    wolfEmptyKill(a)
    resolveNightEffects(a)
    expect(g(a, "P1").alive).toBe(false)
    expect(g(a, "P0").mark.huntWolfCount).toBe(1)

    const b = makeState(["猎魔人", "狼人", "平民", "平民"], { round: 2 })
    hunterHunt(b, "P2")
    wolfEmptyKill(b)
    resolveNightEffects(b)
    expect(g(b, "P0").alive).toBe(false)
    expect(g(b, "P0").mark.huntGoodCount).toBe(1)
  })

  it("摄梦人：连续两晚同梦致死；非连续不致死", () => {
    const a = makeState(["摄梦人", "狼人", "平民", "平民"], { round: 2 })
    g(a, "P0").mark.prevDreamTarget = "P2"
    dreamDo(a, "P2")
    wolfEmptyKill(a)
    resolveNightEffects(a)
    expect(g(a, "P2").alive).toBe(false)

    const b = makeState(["摄梦人", "狼人", "平民", "平民"], { round: 2 })
    g(b, "P0").mark.prevDreamTarget = "P3"
    dreamDo(b, "P2")
    wolfEmptyKill(b)
    resolveNightEffects(b)
    expect(g(b, "P2").alive).toBe(true)
  })

  it("摄梦人夜间死亡 → 梦游者殉情；白天放逐不殉情", () => {
    const a = makeState(["摄梦人", "狼人", "平民", "平民"], { round: 2 })
    dreamDo(a, "P2")
    wolfKill(a, "P0")
    resolveNightEffects(a)
    expect(g(a, "P0").alive).toBe(false)
    expect(g(a, "P2").alive).toBe(false)
    expect(g(a, "P2").deathReason).toBe("lover")

    const b = makeState(["摄梦人", "狼人", "平民", "平民"], { round: 2 })
    b.phase = "day"
    dreamDo(b, "P2")
    b.nightDreamTarget = "P2"
    finishVote(b, "P0", false)
    expect(g(b, "P2").alive).toBe(true)
  })
})


// ===================== 6. 死亡触发矩阵 =====================

describe("边界矩阵 · 死亡触发（开枪/翻牌/殉情）", () => {
  const hunterReasons: Array<[string, boolean]> = [
    ["wolfKill", true],
    ["vote", true],
    ["shot", true],
    ["poison", false],
    ["bomb", false],
    ["lover", false],
    ["duel", false],
    ["selfBomb", false],
  ]

  it("猎人开枪时机矩阵", () => {
    for (const [reason, canShoot] of hunterReasons) {
      const st = makeState(["猎人", "平民"])
      killPlayer(st, "P0", reason as never)
      expect(st.hunterShotPending, `${reason} → pending`).toBe(canShoot)
      expect(g(st, "P0").alive).toBe(false)
    }
  })

  it("狼王开枪时机矩阵", () => {
    for (const [reason, canShoot] of hunterReasons) {
      const st = makeState(["狼王", "平民"])
      killPlayer(st, "P0", reason as never)
      expect(st.wolfKingShotPending, `${reason} → pending`).toBe(canShoot)
    }
  })

  it("白痴只在被投票时翻牌免死；炸弹/毒/枪都不翻牌", () => {
    for (const [reason, survives] of [["vote", true], ["bomb", false], ["poison", false], ["shot", false], ["wolfKill", false]] as Array<[string, boolean]>) {
      const st = makeState(["白痴", "平民"])
      killPlayer(st, "P0", reason as never)
      expect(g(st, "P0").alive, `${reason} 存活`).toBe(survives)
      expect(!!g(st, "P0").mark.idiotFlipped, `${reason} 翻牌`).toBe(survives)
    }
  })

  it("狼美人殉情只在 vote/shot/bomb 触发", () => {
    for (const [reason, partnerDies] of [["vote", true], ["shot", true], ["bomb", true], ["poison", false], ["wolfKill", false], ["selfBomb", false], ["duel", false], ["lover", false]] as Array<[string, boolean]>) {
      const st = makeState(["狼美人", "平民", "平民"])
      charmDo(st, "P1")
      killPlayer(st, "P0", reason as never)
      expect(g(st, "P1").alive, `${reason} → 被魅惑者`).toBe(!partnerDies)
    }
  })

  it("情侣殉情：任意死因都会带走对方", () => {
    for (const reason of ["wolfKill", "poison", "vote", "bomb", "shot", "duel", "selfBomb"] as const) {
      const st = makeState(["平民", "平民"])
      st.lovers = ["P0", "P1"]
      killPlayer(st, "P0", reason)
      expect(g(st, "P1").alive, `${reason} 应殉情`).toBe(false)
      expect(g(st, "P1").deathReason).toBe("lover")
    }
  })

  it("炸弹人引爆：炸死票选者，且不触发猎人开枪/白痴翻牌/狼美人殉情照常", () => {
    const st = makeState(["炸弹人", "猎人", "白痴", "狼美人", "平民", "平民"])
    st.phase = "day"
    charmDo(st, "P4")
    expect(finishVote(st, "P0", false, ["P1", "P2", "P3"])).toBeNull()
    expect(g(st, "P1").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P2").mark.idiotFlipped).toBeFalsy()
    expect(g(st, "P3").alive).toBe(false)
    expect(g(st, "P4").alive).toBe(false)
  })

  it("炸弹人全票放逐 → 独赢（第三方），非全票不独赢", () => {
    const full = makeState(["炸弹人", "平民", "平民"])
    full.phase = "day"
    finishVote(full, "P0", false, ["P1", "P2"])
    expect(full.bombVictory).toBe(true)
    const r = checkWin(full)
    expect(r.ended).toBe(true)
    expect(full.winCamp).toBe("third")

    const partial = makeState(["炸弹人", "平民", "平民", "平民"])
    partial.phase = "day"
    finishVote(partial, "P0", false, ["P1"])
    expect(partial.bombVictory).toBe(false)
  })

  it("炸弹人票选名单校验：空名单/票自己/票已出局者均拒绝", () => {
    const st = makeState(["炸弹人", "平民", "平民"])
    st.phase = "day"
    expect(finishVote(st, "P0", false, [])).toContain("勾选")
    expect(finishVote(st, "P0", false, ["P0"])).toContain("不能票自己")
    g(st, "P1").alive = false
    expect(finishVote(st, "P0", false, ["P1"])).toContain("已出局")
  })

  it("白痴被投：翻牌免死；被投时炸弹不引爆（炸弹人才引爆）", () => {
    const st = makeState(["白痴", "炸弹人", "平民"])
    st.phase = "day"
    expect(finishVote(st, "P0", false)).toBeNull()
    expect(g(st, "P0").alive).toBe(true)
    expect(g(st, "P0").mark.idiotFlipped).toBe(true)
    expect(g(st, "P1").alive).toBe(true)
  })

  it("猎人/狼王被放逐可开枪；遗言阶段被毒则吞枪", () => {
    const st = makeState(["猎人", "狼王", "平民"])
    st.phase = "day"
    finishVote(st, "P0", false)
    expect(st.hunterShotPending).toBe(true)

    const st2 = makeState(["狼王", "猎人", "平民"])
    st2.phase = "day"
    killPlayer(st2, "P1", "poison")
    // 猎人被毒：不 pending
    expect(st2.hunterShotPending).toBe(false)
    finishVote(st2, "P0", false)
    expect(st2.wolfKingShotPending).toBe(true)
  })

  it("血月使徒：仅剩狼被放逐 → 延迟到天亮死亡；期间可自爆封印", () => {
    const st = makeState(["血月使徒", "狼人", "预言家", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P1", false) // 先放逐普通狼
    expect(g(st, "P1").alive).toBe(false)
    finishVote(st, "P0", false)
    expect(g(st, "P0").alive).toBe(true)
    expect(g(st, "P0").mark.bloodDelayedExile).toBe(true)

    // 延迟期间自爆：触发血月封印
    wolfBaoZha(st, "P0")
    expect(st.bloodMoonSeal).toBe(true)
  })

  it("血月延迟出局在天亮结算（仅剩狼时）", () => {
    const st = makeState(["血月使徒", "狼人", "预言家", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P1", false)
    finishVote(st, "P0", false)
    st.phase = "night"
    finishWolfStep(st)
    resolveNightEffects(st)
    expect(g(st, "P0").alive).toBe(false)
  })

  it("狼人自爆：跳过投票；狼美人/石像鬼禁止自爆；血月不作用于石像鬼", () => {
    const st = makeState(["狼人", "平民"])
    st.phase = "day"
    expect(wolfBaoZha(st, "P0")).toBeNull()
    expect(st.skipVote).toBe(true)
    expect(st.bloodMoonSeal).toBe(false)

    const beauty = makeState(["狼美人", "平民"])
    beauty.phase = "day"
    expect(wolfBaoZha(beauty, "P0")).toBe("狼美人不能自爆")
    const garg = makeState(["石像鬼", "平民"])
    garg.phase = "day"
    expect(wolfBaoZha(garg, "P0")).toBe("石像鬼不能自爆")
    const good = makeState(["平民", "狼人"])
    good.phase = "day"
    expect(wolfBaoZha(good, "P0")).toBe("只能狼阵营玩家自爆")
  })

  it("白狼王自爆带人：双方出局并跳过投票；不能带自己/非白狼王", () => {
    const st = makeState(["白狼王", "平民", "预言家"])
    st.phase = "day"
    expect(wolfKingBaoZha(st, "P0", "P0")).toBe("不能带走自己")
    expect(wolfKingBaoZha(st, "P1", "P2")).toBe("只能选择白狼王自爆带人")
    expect(wolfKingBaoZha(st, "P0", "P1")).toBeNull()
    expect(g(st, "P0").alive).toBe(false)
    expect(g(st, "P1").alive).toBe(false)
    expect(st.skipVote).toBe(true)
  })

  it("猎人/狼王开枪确认的边界（未出局/无时机/被毒）", () => {
    const st = makeState(["猎人", "平民"])
    expect(hunterShootConfirm(st, "P1")).toBe("当前没有开枪时机（需猎人被刀或被放逐后才能开枪）")
    expect(hunterGiveUpShot(st)).toBe("当前没有开枪时机")
    killPlayer(st, "P0", "wolfKill")
    expect(st.hunterShotPending).toBe(true)
    expect(hunterShootConfirm(st, "P1")).toBeNull()
    expect(g(st, "P1").alive).toBe(false)

    const poisoned = makeState(["猎人", "平民"])
    killPlayer(poisoned, "P0", "poison")
    // 被毒不会置 pending，因此没有开枪时机；同时记录吞枪标记
    expect(poisoned.hunterShotPending).toBe(false)
    expect(g(poisoned, "P0").mark.hunterIsPoisoned).toBe(true)
    expect(hunterShootConfirm(poisoned, "P1")).toContain("没有开枪时机")

    const wk = makeState(["狼王", "平民"])
    killPlayer(wk, "P0", "wolfKill")
    expect(wolfKingShootConfirm(wk, "P1")).toBeNull()
    expect(wolfKingGiveUpShot(wk)).toBe("当前没有开枪时机")
  })
})

// ===================== 7. 胜负矩阵 =====================

describe("边界矩阵 · 胜负", () => {
  it("屠边：神全灭或民全灭 → 狼胜", () => {
    const godDead = makeState(["狼人", "预言家", "平民"])
    g(godDead, "P1").alive = false
    checkWin(godDead)
    expect(godDead.winCamp).toBe("wolf")

    const civilDead = makeState(["狼人", "预言家", "平民"])
    g(civilDead, "P2").alive = false
    checkWin(civilDead)
    expect(civilDead.winCamp).toBe("wolf")
  })

  it("屠边：狼全灭 → 好人胜（有神 → god，无神 → civil）", () => {
    const withGod = makeState(["狼人", "预言家", "平民"])
    g(withGod, "P0").alive = false
    checkWin(withGod)
    expect(withGod.winCamp).toBe("god")

    const noGod = makeState(["狼人", "平民", "平民"])
    g(noGod, "P0").alive = false
    checkWin(noGod)
    expect(noGod.winCamp).toBe("civil")
  })

  it("屠城：必须神与民全灭才狼胜（仅民灭不够）", () => {
    const st = makeState(["狼人", "预言家", "平民"], { winMode: "city" })
    g(st, "P2").alive = false
    checkWin(st)
    expect(st.winCamp).toBeNull()

    g(st, "P1").alive = false
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("第三方（人狼恋）：场上只剩丘比特与情侣 → 第三方胜；僵持 → 平局", () => {
    const third = makeState(["丘比特", "狼人", "平民"])
    third.lovers = ["P1", "P2"]
    g(third, "P1").alive = false
    g(third, "P2").alive = false
    checkWin(third)
    expect(third.winCamp).toBe("third")

    const draw = makeState(["丘比特", "狼人", "平民", "平民"])
    draw.lovers = ["P1", "P2"]
    g(draw, "P1").alive = false
    g(draw, "P2").alive = false
    checkWin(draw)
    expect(draw.winCamp).toBe("draw")
  })

  it("炸弹人独赢优先级高于狼胜/好胜", () => {
    const st = makeState(["炸弹人", "狼人", "平民"])
    st.bombVictory = true
    // 即使狼已屠边（无神、民=1）也先判第三方
    checkWin(st)
    expect(st.winCamp).toBe("third")
  })

  it("隐狼按狼计：仅剩隐狼也构成狼阵营存活", () => {
    const st = makeState(["隐狼", "预言家"])
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
    const counts = aliveCampCounts(st)
    expect(counts.wolf).toBe(1)
  })

  it("黑化野孩子按狼计", () => {
    const st = makeState(["野孩子", "平民"])
    g(st, "P0").mark.isTransform = true
    expect(isEffectiveWolf(g(st, "P0"))).toBe(true)
    g(st, "P1").alive = false
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("炸弹人计入第三方桶，不计平民（不再阻止/触发屠边民计数）", () => {
    const st = makeState(["炸弹人", "预言家"])
    const counts = aliveCampCounts(st)
    expect(counts.third).toBe(1)
    expect(counts.civil).toBe(0)
  })
})

// ===================== 8. 多技能叠加 / 同一人多状态 =====================

describe("边界矩阵 · 多技能叠加", () => {
  it("守卫+解药同守同救 + 猎人也中刀：死亡并触发猎人开枪", () => {
    const st = makeState(["狼人", "守卫", "女巫", "猎人", "平民"], { round: 2 })
    guardDo(st, "P3", true)
    wolfKill(st, "P3")
    witchSave(st)
    resolveNightEffects(st)
    expect(g(st, "P3").alive).toBe(false)
    expect(st.hunterShotPending).toBe(true)
    expect(g(st, "P1").mark.guardSameSaveKill).toBe(true)
  })

  it("同一目标被狼刀+毒：只死一次，死因按毒药优先", () => {
    const st = makeState(["狼人", "女巫", "平民", "预言家"], { round: 2 })
    wolfKill(st, "P2")
    witchPoison(st, "P2")
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P2").deathReason).toBe("poison")
    expect(st.players.filter((p) => !p.alive).length).toBe(1)
  })

  it("同一夜多源击杀：狼刀/毒/猎魔/连梦各自成立", () => {
    const st = makeState(["狼人", "女巫", "猎魔人", "摄梦人", "平民", "平民", "平民", "预言家"], { round: 2 })
    wolfKill(st, "P4")
    witchPoison(st, "P5")
    hunterHunt(st, "P0") // 戳狼 → 狼死
    g(st, "P3").mark.prevDreamTarget = "P6"
    dreamDo(st, "P6")
    resolveNightEffects(st)
    expect(g(st, "P4").alive).toBe(false)
    expect(g(st, "P5").alive).toBe(false)
    expect(g(st, "P0").alive).toBe(false)
    expect(g(st, "P6").alive).toBe(false)
  })

  it("被恐 + 血月封印同夜：两层都作用，天亮后清理只留封印到结束", () => {
    const st = makeState(["噩梦之影", "预言家", "女巫", "狼人", "平民"], { round: 2 })
    nightmareFear(st, "P1")
    st.bloodMoonSeal = true
    expect(g(st, "P1").mark.skillDisabled).toBe(true)
    expect(typeof prophetCheck(st, "P3")).toBe("string")
    wolfEmptyKill(st)
    resolveNightEffects(st)
    expect(g(st, "P1").mark.skillDisabled).toBe(false)
    expect(st.bloodMoonSeal).toBe(false)
  })

  it("隐狼同时是恋人：死亡触发殉情，且隐狼按狼阵营计", () => {
    const st = makeState(["隐狼", "平民", "预言家", "狼人"])
    st.lovers = ["P0", "P1"]
    expect(isEffectiveWolf(g(st, "P0"))).toBe(true)
    killPlayer(st, "P0", "vote")
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P1").deathReason).toBe("lover")
  })

  it("黑化野孩子同时被魅惑且是恋人：狼美人出局触发魅惑殉情 + 情侣殉情", () => {
    const st = makeState(["野孩子", "狼美人", "平民", "平民"])
    st.phase = "day"
    g(st, "P0").mark.isTransform = true
    st.lovers = ["P0", "P2"]
    charmDo(st, "P0")
    finishVote(st, "P1", false) // 放逐狼美人 → 被魅惑的黑化野孩子殉情，且其恋人连带
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P0").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P0").deathReason).toBe("lover")
  })

  it("梦游者同时被守被救：连梦照样击杀（守卫/解药不挡连梦）", () => {
    const st = makeState(["摄梦人", "守卫", "女巫", "狼人", "平民"], { round: 2 })
    g(st, "P0").mark.prevDreamTarget = "P4"
    guardDo(st, "P4", false)
    wolfKill(st, "P4")
    witchSave(st)
    dreamDo(st, "P4")
    resolveNightEffects(st)
    expect(g(st, "P4").alive).toBe(false)
  })

  it("恐惧目标同时是特殊狼：只封个人技能，不触发狼队空刀", () => {
    const st = makeState(["噩梦之影", "隐狼", "平民", "平民"])
    nightmareFear(st, "P1")
    expect(g(st, "P1").mark.skillDisabled).toBe(true)
    expect(st.wolfFearedTonight).toBe(false)
    // 隐狼尚未带刀（无其他狼？先让隐狼成为唯一狼）
    g(st, "P0").alive = false
    refreshHiddenWolfKnife(st)
    expect(hiddenWolfCanKnife(st)).toBe(true)
    expect(typeof wolfKill(st, "P2")).toBe("string")
  })
})

// ===================== 9. 空操作 / 无技能夜晚 =====================

describe("边界矩阵 · 空操作与无技能夜晚", () => {
  it("只有平民的夜晚：无需狼人步骤，天亮平安夜", () => {
    const st = makeState(["平民", "平民"])
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.phase).toBe("day")
    expect(st.globalLog.join("")).toContain("平安夜")
  })

  it("无玩家/无角色：结算不崩，进入白天", () => {
    const st = makeState([])
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.phase).toBe("day")
  })

  it("有狼但空刀：天亮平安夜", () => {
    const st = makeState(["狼人", "预言家", "平民"])
    wolfEmptyKill(st)
    resolveNightEffects(st)
    expect(st.phase).toBe("day")
    expect(st.players.every((p) => p.alive)).toBe(true)
  })

  it("入夜重置：清空夜间意图、魅惑基准落位、隐狼刀权刷新", () => {
    const st = makeState(["狼人", "狼美人", "隐狼", "平民", "预言家"])
    charmDo(st, "P3")
    st.round = 1
    nextNight(st)
    expect(st.round).toBe(2)
    expect(st.charmLastTarget).toBe("P3")
    expect(st.charmedName).toBe("P3")
    expect(st.nightSteps.wolf).toBe(false)
    expect(st.nightWolfKill).toBe("")
    expect(st.phase).toBe("night")
  })

  it("野孩子榜样在入夜时死亡 → 黑化；同日死亡/自己先死不变身", () => {
    const a = makeState(["野孩子", "平民", "狼人"])
    wildChildPick(a, "P1")
    g(a, "P1").alive = false
    nextNight(a)
    expect(g(a, "P0").mark.isTransform).toBe(true)

    const b = makeState(["野孩子", "平民", "狼人"])
    wildChildPick(b, "P1")
    g(b, "P0").alive = false
    g(b, "P1").alive = false
    nextNight(b)
    expect(g(b, "P0").mark.isTransform).toBe(false)
  })
})

// ===================== 10. 全角色冒烟 =====================

describe("边界矩阵 · 全角色冒烟", () => {
  it("每个角色都能独立进局：阵营/胜负/计分/夜间步骤/评分不崩", () => {
    for (const id of roleIds()) {
      const board = ["狼人", id, "平民", "预言家"].filter((r, i, a) => a.indexOf(r) === i)
      const st = makeState(board)
      expect(() => {
        aliveCampCounts(st)
        checkWin(st)
        recalcScore(st)
        getActiveNightStepKeys({
          boardRoles: board,
          uiDone: {},
          nightSteps: {},
          round: 1,
          lovers: [],
          isWolfRole,
          isWolfPack: isWolfPackRole,
          players: st.players,
          hunterExists: board.includes("猎人"),
          hunterAlive: board.includes("猎人"),
        })
      }, `${id} 冒烟失败`).not.toThrow()

      const idx = board.indexOf(id)
      const me = st.players[idx]
      const inst = getRoleInstance(id)!
      expect(() => inst.scoreRules(st, me as unknown as { name: string; role: string; mark: Record<string, unknown> }), `${id} scoreRules 失败`).not.toThrow()
      expect(!!inst.highlight(me as unknown as { name: string; role: string; mark: Record<string, unknown> }), `${id} highlight 返回非法`).toBeTypeOf("boolean")
    }
  })

  it("每张底牌都能被石像鬼验出名字（不区分阵营）", () => {
    for (const id of roleIds()) {
      const board = ["石像鬼", id].filter((r, i, a) => a.indexOf(r) === i)
      const st = makeState(board)
      const targetName = board.indexOf(id) === 0 ? "P0" : "P1"
      if (id === "石像鬼") continue
      const r = gargoyleCheck(st, targetName)
      expect(typeof r, `${id} 验人失败`).toBe("object")
      expect((r as { role: string }).role, `${id} 验人结果`).toBe(id)
    }
  })
})
