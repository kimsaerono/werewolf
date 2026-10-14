import { describe, it, expect } from "bun:test"
import {
  defaultState,
  newPlayer,
  nextNight,
  resolveNightDeath,
  wolfKill,
  charmDo,
  witchPoison,
  finishVote,
  knightDuel,
  wolfBaoZha,
  wolfKingShootConfirm,
  hunterShootConfirm,
  setJingHui,
  setBoardRoles,
  type GameState,
  type Player,
} from "./logic"

function makePlayers(roles: string[]): Player[] {
  return roles.map((r, i) => {
    const p = newPlayer("P" + i)
    p.role = r
    return p
  })
}

function setup(roles?: string[]): GameState {
  const st = defaultState()
  st.players = makePlayers(roles ?? ["狼美人", "狼人", "预言家", "女巫", "猎人", "骑士", "平民", "平民", "平民", "平民"])
  setBoardRoles(st, st.players.map((p) => p.role))
  st.phase = "day"
  st.round = 1
  return st
}

function byRole(st: GameState, role: string): Player {
  const p = st.players.find((x) => x.role === role)
  if (!p) throw new Error("not found " + role)
  return p
}

describe("狼美人·夜间魅惑", () => {
  it("魅惑成功：写入 charmedName 与 nightSteps.charm", () => {
    const st = setup()
    nextNight(st)
    const target = byRole(st, "平民")
    const err = charmDo(st, target.name)
    expect(err).toBeNull()
    expect(st.charmedName).toBe(target.name)
    expect(st.nightSteps.charm).toBe(true)
  })

  it("不能魅惑自己", () => {
    const st = setup()
    nextNight(st)
    const beauty = byRole(st, "狼美人")
    expect(charmDo(st, beauty.name)).toContain("自己")
  })

  it("不能魅惑已出局玩家", () => {
    const st = setup()
    nextNight(st)
    const target = byRole(st, "平民")
    target.alive = false
    expect(charmDo(st, target.name)).toContain("已出局")
  })

  it("不能连续两晚魅惑同一人", () => {
    const st = setup()
    nextNight(st)
    const target = byRole(st, "平民")
    expect(charmDo(st, target.name)).toBeNull()
    nextNight(st)
    expect(charmDo(st, target.name)).toContain("连续两晚")
  })

  it("换人可连续两晚魅惑", () => {
    const st = setup()
    nextNight(st)
    const civils = st.players.filter((p) => p.role === "平民")
    expect(charmDo(st, civils[0].name)).toBeNull()
    nextNight(st)
    expect(charmDo(st, civils[1].name)).toBeNull()
    expect(st.charmedName).toBe(civils[1].name)
  })
})

describe("狼美人·禁刀 / 禁自爆", () => {
  it("狼刀拒绝目标为狼美人", () => {
    const st = setup()
    nextNight(st)
    const beauty = byRole(st, "狼美人")
    expect(wolfKill(st, beauty.name)).toContain("禁止被刀")
    expect(st.nightWolfKill).toBe("")
  })

  it("狼美人不能自爆", () => {
    const st = setup()
    const beauty = byRole(st, "狼美人")
    expect(wolfBaoZha(st, beauty.name)).toContain("不能自爆")
    expect(beauty.alive).toBe(true)
  })
})

describe("狼美人·殉情触发（vote/poison/shot）", () => {
  it("被放逐：被魅惑者殉情", () => {
    const st = setup()
    const beauty = byRole(st, "狼美人")
    const target = byRole(st, "平民")
    setJingHui(st, target.name, false)
    nextNight(st)
    charmDo(st, target.name)
    finishVote(st, beauty.name, false)
    expect(beauty.alive).toBe(false)
    expect(beauty.deathReason).toBe("vote")
    expect(target.alive).toBe(false)
    expect(target.deathReason).toBe("lover")
    // 被魅惑者恰为警长：殉情后警徽待移交
    expect(st.badgePending).toBe(target.name)
  })

  it("被毒杀：被魅惑者殉情", () => {
    const st = setup()
    nextNight(st)
    const beauty = byRole(st, "狼美人")
    const target = byRole(st, "平民")
    charmDo(st, target.name)
    wolfKill(st, byRole(st, "狼人").name)
    expect(witchPoison(st, beauty.name)).toBeNull()
    resolveNightDeath(st)
    expect(beauty.alive).toBe(false)
    expect(beauty.deathReason).toBe("poison")
    expect(target.alive).toBe(false)
    expect(target.deathReason).toBe("lover")
  })

  it("被猎人枪杀：被魅惑者殉情", () => {
    const st = setup()
    const beauty = byRole(st, "狼美人")
    const target = byRole(st, "平民")
    const hunter = byRole(st, "猎人")
    nextNight(st)
    charmDo(st, target.name)
    // 猎人被刀后可开枪
    st.hunterShotPending = true
    hunter.alive = false
    expect(hunterShootConfirm(st, beauty.name)).toBeNull()
    expect(beauty.alive).toBe(false)
    expect(target.alive).toBe(false)
  })

  it("被狼王枪杀：被魅惑者殉情", () => {
    const st = setup(["狼美人", "狼王", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民"])
    const beauty = byRole(st, "狼美人")
    const wk = byRole(st, "狼王")
    const target = byRole(st, "平民")
    nextNight(st)
    charmDo(st, target.name)
    wk.alive = false
    st.wolfKingShotPending = true
    expect(wolfKingShootConfirm(st, beauty.name)).toBeNull()
    expect(beauty.alive).toBe(false)
    expect(target.alive).toBe(false)
  })
})

describe("狼美人·殉情不触发", () => {
  it("被决斗出局：不触发殉情", () => {
    const st = setup()
    const beauty = byRole(st, "狼美人")
    const target = byRole(st, "平民")
    nextNight(st)
    charmDo(st, target.name)
    expect(knightDuel(st, beauty.name)).toBeNull()
    expect(beauty.alive).toBe(false)
    expect(beauty.deathReason).toBe("duel")
    expect(target.alive).toBe(true)
  })

  it("未魅惑时出局：无殉情", () => {
    const st = setup()
    const beauty = byRole(st, "狼美人")
    nextNight(st)
    finishVote(st, beauty.name, false)
    expect(beauty.alive).toBe(false)
    expect(st.players.filter((p) => p.deathReason === "lover").length).toBe(0)
  })
})

describe("狼美人·殉情者不能开技能", () => {
  it("被魅惑的猎人殉情后不能开枪", () => {
    const st = setup()
    const beauty = byRole(st, "狼美人")
    const hunter = byRole(st, "猎人")
    nextNight(st)
    charmDo(st, hunter.name)
    finishVote(st, beauty.name, false)
    expect(hunter.alive).toBe(false)
    expect(hunter.deathReason).toBe("lover")
    // 殉情绕过死亡钩子：不置开枪时机
    expect(st.hunterShotPending).toBe(false)
  })
})
