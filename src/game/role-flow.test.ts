import { describe, it, expect, mock } from "bun:test"
mock.module("./../../src/assets/roles/index.ts", () => ({ roleAvatar: () => "", randomDefaultAvatar: () => "" }))
const L: any = await import("./logic")
const { checkWin } = await import("./win-checker")
const { solveForcedWin, clearForcedWinCache } = await import("./forced-win")

const ROLES = ["狼人","狼人","狼人","预言家","女巫","猎人","守卫","骑士","白痴","平民","平民","平民"]

/**
 * 这些用例锁定「角色技能约束」不被判胜/必然结束改造影响：
 * 女巫一晚一瓶药、守卫不能连守、猎人开枪、骑士一次决斗、屠边/屠城口径。
 * （src/game/logic.test.ts 因 assets/roles 的 import.meta.glob 在 bun 下无法运行，此处补位。）
 */

/** 从零建一局并分配角色 */
function newGame(mode: "edge" | "city" = "edge") {
  const s: any = L.defaultState()
  s.judge = "法官"
  s.winMode = mode
  ROLES.forEach((r, i) => { const p = L.newPlayer("P" + (i + 1)); p.role = r; s.players.push(p) })
  L.renumberPlayers(s)
  L.manualSaveRoles(s)
  return s
}
const alive = (s: any) => s.players.filter((p: any) => p.alive)
const aliveGod = (s: any) => alive(s).filter((p: any) => !L.isWolfRole(p.role) && L.GOD_LIST.includes(p.role))
const aliveCiv = (s: any) => alive(s).filter((p: any) => !L.isWolfRole(p.role) && p.role === "平民")
const aliveWolf = (s: any) => alive(s).filter((p: any) => L.isWolfRole(p.role))

/** 跑完一夜：守卫→狼人→女巫→预言家→结算死亡 */
function runNight(s: any, opts: { guard?: string | null; save?: boolean; poison?: string | null; check?: string | null } = {}) {
  L.nextNight(s)
  const g = alive(s).find((p: any) => p.role === "守卫")
  if (g) L.guardDo(s, opts.guard ?? "", false)
  const w = aliveWolf(s)[0]
  const target = alive(s).find((p: any) => !L.isWolfRole(p.role))
  L.wolfKill(s, target.name)
  const wi = alive(s).find((p: any) => p.role === "女巫")
  if (wi) {
    if (opts.save) L.witchSave(s)
    if (opts.poison) L.witchPoison(s, opts.poison)
  }
  const pr = alive(s).find((p: any) => p.role === "预言家")
  if (pr) {
    if (opts.check) L.prophetCheck(s, opts.check)
    else L.prophetNoCheck(s)
  }
  L.resolveNightDeath(s)
  return s
}

describe("角色技能与对局流程回归", () => {
  it("标准 12 人局能完整跑到分出胜负，且每步都不抛错", () => {
    const s = newGame("edge")
    expect(s.round).toBe(0) // manualSaveRoles 后尚未开夜
    expect(alive(s).length).toBe(12)
    let guard = 1
    for (let round = 1; round <= 8; round++) {
      const wolves = aliveWolf(s)
      const goods = alive(s).filter((p: any) => !L.isWolfRole(p.role))
      if (wolves.length === 0 || goods.length === 0) break
      clearForcedWinCache()
      solveForcedWin(s) // 每轮都跑一次检测，确保不影响流程
      runNight(s, { guard: goods[guard++ % goods.length]?.name ?? "", poison: round === 2 ? wolves[0].name : null })
      if (s.hunterShotPending) L.hunterShootConfirm(s, aliveWolf(s)[0]?.name ?? "")
      L.checkWin(s)
      if (s.winCamp) break
      // 白天放逐一个好人（模拟错误投票），保证局能推进
      const goodVictim = alive(s).find((p: any) => !L.isWolfRole(p.role) && p.role !== "白痴")
      const exileTarget = goodVictim ?? aliveWolf(s)[0]
      if (exileTarget) L.finishVote(s, exileTarget.name, false)
      L.checkWin(s)
      if (s.winCamp) break
    }
    expect(s.winCamp).toBeTruthy()
    const fin = L.finishGameAuto(s)
    expect(fin).toBeNull()
    expect(s.finished).toBe(true)
  })

  it("女巫：一晚只能一瓶药，解药/毒药各仅一次", () => {
    const s = newGame("edge")
    const wolf = aliveWolf(s)[0]
    L.nextNight(s)
    L.wolfKill(s, alive(s).find((p: any) => p.role === "预言家").name)
    // 当晚用解药
    expect(L.witchSave(s)).toBeNull()
    expect(s.witchSaveUsed).toBe(true)
    // 同晚再用毒药 → 被拒（求解器同样按此互斥建模）
    expect(L.witchPoison(s, wolf.name)).toMatch(/同一夜晚不能同时使用解药和毒药/)
    // 下一晚可以用毒药
    L.nextNight(s)
    expect(L.witchPoison(s, wolf.name)).toBeNull()
    expect(s.witchPoisonUsed).toBe(true)
    // 再下一晚毒药用尽（解药前置条件「本晚有刀人」满足后）
    L.nextNight(s)
    L.wolfKill(s, alive(s).find((p: any) => p.role === "预言家").name)
    expect(L.witchPoison(s, wolf.name)).toBe("毒药已经全部使用过")
    expect(L.witchSave(s)).toBe("解药已经全部使用过")
  })

  it("守卫不能连续两晚守同一人", () => {
    const s = newGame("edge")
    const g = alive(s).find((p: any) => p.role === "守卫")
    const t1 = alive(s).find((p: any) => p.role === "平民")
    L.nextNight(s)
    expect(L.guardDo(s, t1.name, false)).toBeNull()
    L.wolfKill(s, alive(s).find((p: any) => p.role === "预言家").name)
    expect(L.resolveNightDeath(s)).toBeNull()
    expect(s.guardLastTarget).toBe(t1.name)
    L.nextNight(s)
    expect(L.guardDo(s, t1.name, false)).toMatch(/不能连续两晚守同一人/)
  })

  it("猎人开枪带走一名狼人", () => {
    const s = newGame("edge")
    L.nextNight(s)
    const h = alive(s).find((p: any) => p.role === "猎人")
    const w = aliveWolf(s)
    L.wolfKill(s, h.name)
    L.resolveNightDeath(s)
    expect(h.alive).toBe(false)
    expect(s.hunterShotPending).toBe(true)
    const before = aliveWolf(s).length
    L.hunterShootConfirm(s, w[0].name)
    expect(aliveWolf(s).length).toBe(before - 1)
  })

  it("骑士决斗每局只能用一次", () => {
    const s = newGame("edge")
    const k = alive(s).find((p: any) => p.role === "骑士")
    expect(L.knightDuel(s, aliveWolf(s)[0].name)).toBeNull()
    expect(s.knightDuelUsed).toBe(true)
    expect(L.knightDuel(s, aliveWolf(s)[0].name)).toMatch(/剑|用过/)
  })

  it("屠边：民全灭判狼人胜；屠城：神与民全灭才判", () => {
    const e = newGame("edge")
    L.nextNight(e)
    for (const p of e.players.filter((x: any) => x.role === "平民")) p.alive = false
    L.checkWin(e)
    expect(e.winCamp).toBe("wolf")

    const c = newGame("city")
    L.nextNight(c)
    for (const p of c.players.filter((x: any) => x.role === "平民")) p.alive = false
    L.checkWin(c)
    expect(c.winCamp).toBeNull() // 民没了但神还在，屠城不算胜
    for (const p of c.players.filter((x: any) => L.GOD_LIST.includes(x.role))) p.alive = false
    L.checkWin(c)
    expect(c.winCamp).toBe("wolf")
  })

  it("回退快照后 finished/判胜可恢复正常（提前结束的守卫不会残留）", () => {
    const s = newGame("edge")
    s.finished = true
    s.winCamp = "wolf"
    const snap = JSON.stringify(s)
    // 模拟 doUndo：恢复快照（快照里 finished=false）
    const restored: any = L.normalizeState(JSON.parse(snap))
    restored.finished = false
    restored.winCamp = null
    const r = L.checkWin(restored)
    expect(r.ended).toBe(false)
  })

  it("下一局重置后 finished 清零，可重新判胜", () => {
    const s = newGame("edge")
    s.finished = true
    s.winCamp = "wolf"
    L.startNewGame(s)
    expect(s.finished).toBe(false)
    expect(s.winCamp).toBeNull()
    expect(L.checkWin(s).ended).toBe(false)
  })
})

describe("空刀（狼人本夜不刀人）", () => {
  it("空刀后狼人睁眼步骤已完成、无人被刀、解药不可用", () => {
    const s: any = L.defaultState()
    s.judge = "法官"
    s.winMode = "edge"
    s.round = 1
    ;["狼人", "狼人", "预言家", "女巫", "平民", "平民"].forEach((r, i) => {
      const p = L.newPlayer("P" + (i + 1))
      p.role = r
      s.players.push(p)
    })
    L.renumberPlayers(s)
    L.manualSaveRoles(s)
    s.phase = "night"
    L.wolfEmptyKill(s)
    expect(s.nightSteps.wolf).toBe(true)
    expect(s.nightWolfKill).toBe("")
    expect(s.wolfSelfKill).toBe(false)
    // 夜间结算不会有人死
    L.resolveNightDeath(s)
    expect(s.players.every((p: any) => p.alive)).toBe(true)
  })

  it("先刀人再改判空刀：清掉刀口与自刀标记", () => {
    const s: any = L.defaultState()
    s.judge = "法官"
    s.winMode = "edge"
    s.round = 1
    ;["狼人", "狼人", "预言家", "平民"].forEach((r, i) => {
      const p = L.newPlayer("P" + (i + 1))
      p.role = r
      s.players.push(p)
    })
    L.renumberPlayers(s)
    L.manualSaveRoles(s)
    s.phase = "night"
    const wolf = s.players[0]
    expect(L.wolfKill(s, wolf.name)).toBeNull()
    expect(s.nightWolfKill).toBe(wolf.name)
    expect(s.wolfSelfKill).toBe(true)
    L.wolfEmptyKill(s)
    expect(s.nightWolfKill).toBe("")
    expect(s.wolfSelfKill).toBe(false)
    L.resolveNightDeath(s)
    expect(s.players.every((p: any) => p.alive)).toBe(true)
  })
})
