import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { Camp, RoleDef, ScoreEntry } from "./types"
import { isWolfRole } from "../logic"
import { getRoleInstance } from "./builtin"

/**
 * 丘比特角色：首夜可连两名玩家为情侣。
 * 第三方胜负判定：人狼恋时，若场上只剩第三方成员，则第三方胜利。
 */
export class CupidRole extends BaseRole {
  readonly def: RoleDef = {
    id: "丘比特",
    camp: "third",
    unique: true,
    emoji: "💘",
    short: "丘",
    winRule: { priority: 0, judge: () => null }, // 优先级最高
  }

  winRule(state: GameState): { camp: Camp | "draw"; reason: string } | null {
    // 检查是否人狼恋
    if (state.lovers.length !== 2) return null
    const [a, b] = state.lovers
    const pa = state.players.find((p) => p.name === a)
    const pb = state.players.find((p) => p.name === b)
    if (!pa || !pb) return null

    const wa = isWolfRole(pa.role)
    const wb = isWolfRole(pb.role)
    if (wa === wb) return null // 不是人狼恋

    // 人狼恋：检查第三方胜利条件
    const aliveAll = state.players.filter((p) => p.alive)
    const thirdMembers = aliveAll.filter((p) => {
      const role = getRoleInstance(p.role)
      return (role && role.def.id === "丘比特") || state.lovers.includes(p.name)
    })

    // 第三方胜利：场上只剩第三方成员
    if (aliveAll.length > 0 && aliveAll.every((p) => {
      const role = getRoleInstance(p.role)
      return (role && role.def.id === "丘比特") || state.lovers.includes(p.name)
    })) {
      return { camp: "third", reason: "场上只剩丘比特与人狼情侣，第三方存活到最后" }
    }

    // 平局：狼全灭 + 剩余全是平民，且平民投票无法放逐第三方
    const aliveWolf = state.players.filter((p) => p.alive && isWolfRole(p.role))
    if (aliveWolf.length === 0) {
      const aliveNonThird = aliveAll.filter((p) => !thirdMembers.includes(p))
      const onlyCivil = aliveNonThird.every((p) => {
        const role = getRoleInstance(p.role)
        return role && role.def.camp === "villager"
      })
      if (onlyCivil && aliveNonThird.length <= thirdMembers.length) {
        return { camp: "draw", reason: "第三方与平民票数持平僵持，无法继续放逐，平局" }
      }
    }

    // 第三方活跃时，好/狼不判胜
    return null
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }
}