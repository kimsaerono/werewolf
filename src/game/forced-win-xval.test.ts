import { describe, it, expect, mock } from "bun:test"
mock.module("./../../src/assets/roles/index.ts", () => ({ roleAvatar: () => "", randomDefaultAvatar: () => "" }))
const L: any = await import("./logic")
const { analyzeCertainty, clearForcedWinCache } = await import("./forced-win")
const { checkWin } = await import("./win-checker")

/**
 * 交叉验证：求解器给出的「必胜」结论，必须能用真实引擎 logic.ts 复现同一条路线。
 * 这样才能保证求解器建模的放逐/枪/自爆规则与实际对局一致，而不是自说自话。
 */
function build(roles: string[], mode: "edge" | "city", phase: "night" | "day" = "day") {
  clearForcedWinCache()
  const s: any = L.defaultState()
  s.judge = "法官"
  s.winMode = mode
  s.phase = "night"
  s.round = 1
  roles.forEach((r, i) => {
    const p = L.newPlayer(`P${i + 1}`)
    p.role = r
    s.players.push(p)
  })
  L.renumberPlayers(s)
  L.manualSaveRoles(s)
  s.phase = phase
  s.round = 1
  return s
}
const W = (s: any) => s.players.find((p: any) => p.alive && L.isWolfRole(p.role))
const byRole = (s: any, r: string) => s.players.find((p: any) => p.alive && p.role === r)

describe("必然结束结论 × 真实引擎交叉验证", () => {
  it("夜刀平民 → 白天放逐猎人 → 猎人枪打狼 → 屠城狼胜", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"], "city", "night")
    expect(analyzeCertainty(s).minNights).toBe(1)
    const civ = byRole(s, "平民")
    L.nextNight(s)
    expect(L.wolfKill(s, civ.name)).toBeNull()
    L.resolveNightDeath(s)
    expect(civ.alive).toBe(false)
    const hunter = byRole(s, "猎人")
    expect(L.finishVote(s, hunter.name, false)).toBeNull()
    expect(s.hunterShotPending).toBe(true)
    expect(L.hunterShootConfirm(s, W(s).name)).toBeNull()
    expect(checkWin(s).ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("夜刀女巫 → 白天放逐平民 → 屠城狼胜", () => {
    const s = build(["狼人", "狼人", "女巫", "平民"], "city", "night")
    expect(analyzeCertainty(s).minNights).toBe(1)
    const witch = byRole(s, "女巫")
    L.nextNight(s)
    expect(L.wolfKill(s, witch.name)).toBeNull()
    L.resolveNightDeath(s)
    expect(witch.alive).toBe(false)
    expect(L.finishVote(s, byRole(s, "平民").name, false)).toBeNull()
    expect(checkWin(s).ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("反例护栏：1狼1猎人1民 屠城，好人放逐猎人后枪响翻盘", () => {
    // 屠城 1狼1猎人1民：好人放逐猎人 → 枪响打狼 → 好人胜，狼人拿不到必胜
    expect(analyzeCertainty(build(["狼人", "猎人", "平民"], "city", "night")).winner).not.toBe("wolf")
    const s = build(["狼人", "猎人", "平民"], "city", "day")
    const hunter = byRole(s, "猎人")
    expect(L.finishVote(s, hunter.name, false)).toBeNull()
    expect(s.hunterShotPending).toBe(true)
    L.hunterShootConfirm(s, W(s).name)
    expect(checkWin(s).ended).toBe(true)
    expect(s.winCamp).not.toBe("wolf")
  })

  it("反例护栏：唯一狼人是狼王时被放逐，狼人当场全灭 → 好人胜（狼枪来不及）", () => {
    // 唯一狼人是狼王：白天被放逐即全灭，狼枪来不及
    expect(analyzeCertainty(build(["狼王", "猎人", "平民", "平民"], "edge", "day")).winner).not.toBe("wolf")
    const s = build(["狼王", "猎人", "平民", "平民"], "edge", "day")
    expect(L.finishVote(s, byRole(s, "狼王").name, false)).toBeNull()
    expect(s.players.filter((p: any) => p.alive && L.isWolfRole(p.role)).length).toBe(0)
    expect(checkWin(s).ended).toBe(true)
    expect(s.winCamp).not.toBe("wolf")
  })

  it("狼王被放逐后开枪：2狼(狼王+普通)+猎人+民 屠边，放逐猎人当场结束", () => {
    const s = build(["狼王", "狼人", "猎人", "平民"], "edge", "day")
    const r = analyzeCertainty(s)
    expect(r.winner).toBe("wolf")
    // 平票由法官裁决：放逐猎人/平民都是当场结束，但法官若放逐狼人，就要再入夜，
    // 所以最慢路径是 1 夜（这正是「法官能放逐狼人」这个选项必须参与 AND 的原因）
    expect(r.minNights).toBe(1)
    const hunter = byRole(s, "猎人")
    expect(L.finishVote(s, hunter.name, false)).toBeNull()
    L.hunterShootConfirm(s, byRole(s, "狼王").name)
    expect(checkWin(s).ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("夜刀平民即屠民（狼王的枪只在被放逐后生效）", () => {
    const s = build(["狼王", "猎人", "平民"], "edge", "night")
    expect(analyzeCertainty(s).winner).toBe("wolf")
    const civ = byRole(s, "平民")
    L.nextNight(s)
    expect(L.wolfKill(s, civ.name)).toBeNull()
    L.resolveNightDeath(s)
    expect(checkWin(s).ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("提前结算：按求解结果写胜方、结束标记与带原因的日志", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"], "edge", "night")
    const forced = analyzeCertainty(s)
    expect(forced.tier).not.toBe("even")
    expect(forced.winner).toBe("wolf")
    expect(L.finishGameAuto(s, { camp: "wolf", reason: forced.reason })).toBeNull()
    expect(s.winCamp).toBe("wolf")
    expect(s.finished).toBe(true)
    expect(s.globalLog[s.globalLog.length - 1]).toContain("提前结束")
    expect(s.globalLog[s.globalLog.length - 1]).toContain(forced.reason)
    // 结算后 checkWin 不再重判，winCamp 不会被后续 refresh 覆盖成 null
    expect(checkWin(s).ended).toBe(false)
    expect(checkWin(s).text).toBe("")
    expect(s.winCamp).toBe("wolf")
  })

  it("白狼王自爆带走一人并跳过投票：真实引擎可复现", () => {
    const s = build(["白狼王", "狼人", "平民", "平民"], "edge", "day")
    const wwk = byRole(s, "白狼王")
    const civ = byRole(s, "平民")
    expect(L.wolfKingBaoZha(s, wwk.name, civ.name)).toBeNull()
    expect(wwk.alive).toBe(false)
    expect(civ.alive).toBe(false)
    expect(s.skipVote).toBe(true)
    expect(L.finishVote(s, byRole(s, "平民").name, false)).toMatch(/跳过投票/)
  })
})
