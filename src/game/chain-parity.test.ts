import { describe, it, expect } from "bun:test"
import { defaultState, newPlayer, getChainType as logicChain, isThirdMember as logicThird } from "./logic"
import { getChainType as wcChain, isThirdMember as wcThird } from "./win-checker"
import type { GameState } from "./logic"

/**
 * 链型 / 第三方成员在 logic.ts 与 win-checker.ts 各有一份实现。
 * 两份必须完全同口径，否则「胜负判定」与「计分/UI」会各说各话
 * （历史上丘比特 winRule 就因使用原始阵营而把 WG→WW 误判成第三方胜）。
 */

function build(roles: string[], lovers: string[] = [], transformed: string[] = []): GameState {
  const st = defaultState()
  st.boardRoles = [...roles]
  st.players = roles.map((role, i) => {
    const p = newPlayer(`P${i}`)
    p.role = role
    return p
  })
  for (const name of transformed) {
    const p = st.players.find((x) => x.name === name)
    if (p) p.mark.isTransform = true
  }
  st.lovers = lovers
  return st
}

describe("链型 / 第三方成员 · logic ↔ win-checker parity", () => {
  const cases: Array<{ name: string; roles: string[]; lovers: string[]; transformed?: string[] }> = [
    { name: "未连人", roles: ["狼人", "平民", "丘比特"] },
    { name: "GG 人人恋", roles: ["平民", "平民", "狼人", "丘比特"], lovers: ["P0", "P1"] },
    { name: "WG 人狼恋", roles: ["狼人", "平民", "丘比特"], lovers: ["P0", "P1"] },
    { name: "WW 狼狼恋", roles: ["狼人", "狼人", "丘比特"], lovers: ["P0", "P1"] },
    {
      name: "GG→WG（野孩子黑化）",
      roles: ["野孩子", "平民", "狼人", "丘比特"],
      lovers: ["P0", "P1"],
      transformed: ["P0"],
    },
    {
      name: "WG→WW（野孩子黑化）",
      roles: ["野孩子", "狼人", "丘比特", "平民"],
      lovers: ["P0", "P1"],
      transformed: ["P0"],
    },
  ]

  for (const c of cases) {
    it(`${c.name}：链型一致`, () => {
      const st = build(c.roles, c.lovers, c.transformed)
      expect(logicChain(st)).toBe(wcChain(st))
    })

    it(`${c.name}：每个玩家的第三方成员判定一致`, () => {
      const st = build(c.roles, c.lovers, c.transformed)
      for (const p of st.players) {
        expect(logicThird(st, p)).toBe(wcThird(st, p))
      }
    })
  }

  it("角色未分配：两边都返回空链型（不再一边空串、一边 GG）", () => {
    const st = build(["", "", "丘比特"], ["P0", "P1"])
    expect(logicChain(st)).toBe("")
    expect(wcChain(st)).toBe("")
  })
})
