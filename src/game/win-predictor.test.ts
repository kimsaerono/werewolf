import { describe, it, expect, mock } from "bun:test"

mock.module("./../../src/assets/roles/index.ts", () => ({
  roleAvatar: () => "",
  randomDefaultAvatar: () => "",
}))

const { defaultState, newPlayer, renumberPlayers } = await import("./logic")
const { predictWinRate } = await import("./win-predictor")

describe("win-predictor baseline", () => {
  it("fresh 9-player standard board opens 50/50", () => {
    const s = defaultState()
    s.board = "9"
    const names = ["A","B","C","D","E","F","G","H","I"]
    const roles = ["狼人","狼人","狼人","预言家","女巫","猎人","平民","平民","平民"]
    for (let i = 0; i < 9; i++) {
      const p = newPlayer(names[i])
      p.role = roles[i]
      s.players.push(p)
    }
    renumberPlayers(s)
    const r = predictWinRate(s)
    expect(r.rates.wolf).toBe(50)
    expect(r.rates.good).toBe(50)
    expect(r.hasThird).toBe(false)
    console.log("fresh 9p → wolf:", r.rates.wolf, "good:", r.rates.good)
  })

  it("one wolf dead → wolf rate drops", () => {
    const s = defaultState()
    s.board = "9"
    const names = ["A","B","C","D","E","F","G","H","I"]
    const roles = ["狼人","狼人","狼人","预言家","女巫","猎人","平民","平民","平民"]
    for (let i = 0; i < 9; i++) {
      const p = newPlayer(names[i])
      p.role = roles[i]
      s.players.push(p)
    }
    renumberPlayers(s)
    s.players.find(p => p.role === "狼人")!.alive = false
    const r = predictWinRate(s)
    expect(r.rates.wolf).toBeLessThan(30)
    console.log("1 wolf dead → wolf:", r.rates.wolf, "good:", r.rates.good)
  })

  it("no third party shown for plain board", () => {
    const s = defaultState()
    s.board = "9"
    const names = ["A","B","C","D","E","F","G","H","I"]
    const roles = ["狼人","狼人","狼人","预言家","女巫","猎人","平民","平民","平民"]
    for (let i = 0; i < 9; i++) {
      const p = newPlayer(names[i])
      p.role = roles[i]
      s.players.push(p)
    }
    renumberPlayers(s)
    expect(predictWinRate(s).hasThird).toBe(false)
  })
})