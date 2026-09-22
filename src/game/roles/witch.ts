import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry } from "./types"

/**
 * 女巫角色：每晚可救/毒一人。
 */
export class WitchRole extends BaseRole {
  readonly def: RoleDef = {
    id: "女巫",
    camp: "god",
    unique: true,
    emoji: "🧙",
    short: "巫",
    nightStep: { order: 30, key: "witch" },
    intentKeys: ["nightWitchSave", "nightWitchPoison", "nightUsedDrug"],
  }

  onNightResolve(state: GameState): Effect[] {
    const effects: Effect[] = []

    // 解药：只有首夜或女巫存活且未用过解药时生效
    if (state.nightUsedDrug === "save" && state.witchSaveUsed && state.nightWitchSave) {
      effects.push({
        type: "save",
        target: state.nightWitchSave,
        source: "女巫解药",
      })
    }

    // 毒药
    if (state.nightWitchPoison) {
      effects.push({
        type: "kill",
        target: state.nightWitchPoison,
        source: "女巫毒药",
      })
    }

    return effects
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    // 兼容旧标记名
    if (m.witchSave || m.witchSaveGood) entries.push({ reason: "救对好人", delta: 0.5 })
    if (m.witchPoisonWolf || m.witchPoWolf) entries.push({ reason: "毒狼", delta: 1 })
    if (m.witchPoisonGood || m.witchPoGood) entries.push({ reason: "毒好人", delta: -1 })
    if (m.witchSaveWolf) entries.push({ reason: "救狼", delta: -1 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    const m = player.mark
    return !!(m.witchPoWolf || m.witchPoisonWolf || m.witchSaveGood || m.witchSave)
  }
}