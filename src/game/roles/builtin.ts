import type { RoleDef } from "./types"
import { BaseRole } from "./base"
import { registerRole } from "./registry"
import { WerewolfRole } from "./werewolf"
import { WhiteWolfKingRole } from "./white-wolf-king"
import { WolfKingRole } from "./wolf-king"
import { ProphetRole } from "./prophet"
import { WitchRole } from "./witch"
import { HunterRole } from "./hunter"
import { GuardRole } from "./guard"
import { KnightRole } from "./knight"
import { IdiotRole } from "./idiot"
import { VillagerRole } from "./villager"
import { CupidRole } from "./cupid"
import { onBeforeDeath, onAfterDeath } from "../logic"

/**
 * 内置 11 个角色定义（从 logic.ts / GamePanel.vue 散落常量迁移而来，行为语义不变）。
 * 新增角色：往下方数组追加一条 RoleDef 即可，核心流程代码无需改动。
 */
export const BUILTIN_ROLES: RoleDef[] = [
  {
    id: "狼人", camp: "wolf", unique: false, emoji: "🐺", short: "狼", intentKeys: ["nightWolfKill"],
    nightStep: {
      order: 30, key: "wolf", label: "狼人刀人", emoji: "🌑",
      enabled: (c) => {
        const quota = c.boardRoles.filter(c.isWolfRole).length
        const confirmed = c.players.filter((p) => c.isWolfRole(p.role)).length >= quota
        const aliveWolf = c.players.some((p) => p.alive && c.isWolfRole(p.role))
        return quota > 0 && (!confirmed || aliveWolf)
      },
    },
  },
  { id: "白狼王", camp: "wolf", unique: true, emoji: "❄️🐺", short: "白狼", intentKeys: [] },
  { id: "狼王", camp: "wolf", unique: true, emoji: "🔫🐺", short: "狼王", intentKeys: [] },
  {
    id: "预言家", camp: "god", unique: true, emoji: "🔮", short: "预", intentKeys: ["nightProphetCheck"],
    nightStep: { order: 50, key: "prophet", label: "预言家验人", emoji: "🔮", enabled: (c) => c.boardRoles.includes("预言家") },
  },
  {
    id: "女巫", camp: "god", unique: true, emoji: "🧙", short: "巫", intentKeys: ["nightWitchSave", "nightWitchPoison", "nightUsedDrug"],
    nightStep: { order: 40, key: "witch", label: "女巫操作", emoji: "🧪" },
  },
  {
    id: "猎人", camp: "god", unique: true, emoji: "🔫", short: "猎", intentKeys: [],
    nightStep: { order: 80, key: "hunterOpen", label: "猎人睁眼", emoji: "🔫", enabled: (c) => c.boardRoles.includes("猎人") && (!c.hunterExists || c.hunterAlive) },
  },
  {
    id: "守卫", camp: "god", unique: true, emoji: "🛡️", short: "守", intentKeys: ["nightGuardTarget"],
    nightStep: { order: 20, key: "guard", label: "守卫守人", emoji: "🛡️" },
  },
  {
    id: "骑士", camp: "god", unique: true, emoji: "⚔️", short: "骑", intentKeys: [],
    nightStep: { order: 70, key: "knight", label: "骑士睁眼", emoji: "⚔️", enabled: (c) => c.round <= 1 && c.boardRoles.includes("骑士") },
  },
  {
    id: "白痴", camp: "god", unique: true, emoji: "🙊", short: "痴", countsAsGod: false, intentKeys: [],
    nightStep: { order: 60, key: "idiotOpen", label: "白痴睁眼", emoji: "🙊", enabled: (c) => c.round <= 1 && c.boardRoles.includes("白痴") },
  },
  { id: "平民", camp: "villager", unique: false, emoji: "👤", short: "民", intentKeys: [] },
  {
    id: "丘比特", camp: "third", unique: true, emoji: "💘", short: "丘", intentKeys: ["lovers"],
    nightStep: { order: 10, key: "cupid", label: "丘比特连人", emoji: "💘", enabled: (c) => c.round <= 1 && c.boardRoles.includes("丘比特") },
  },
]

// ===================== 角色实例注册（Phase 2：行为迁移）=====================

/** 角色实例映射：id → 角色实例 */
const roleInstances = new Map<string, BaseRole>()

/** 获取角色实例 */
export function getRoleInstance(id: string): BaseRole | undefined {
  return roleInstances.get(id)
}

/** 初始化：注册所有内置角色的实例和钩子 */
export function initBuiltinRoles(): void {
  // 创建实例
  const roles = [
    new WerewolfRole(),
    new WhiteWolfKingRole(),
    new WolfKingRole(),
    new ProphetRole(),
    new WitchRole(),
    new HunterRole(),
    new GuardRole(),
    new KnightRole(),
    new IdiotRole(),
    new VillagerRole(),
    new CupidRole(),
  ]

  for (const role of roles) {
    roleInstances.set(role.def.id, role)
    // 注册死亡前钩子
    if (role.onBeforeDeath) {
      onBeforeDeath((state, evt) => {
        const p = state.players.find((x) => x.name === evt.name)
        if (p && p.role === role.def.id) {
          return role.onBeforeDeath(state, evt)
        }
        return false
      })
    }
    // 注册死亡后钩子
    if (role.onAfterDeath) {
      onAfterDeath((state, evt) => {
        const p = state.players.find((x) => x.name === evt.name)
        if (p && p.role === role.def.id) {
          role.onAfterDeath(state, evt)
        }
      })
    }
  }
}

/** 是否已初始化（防止重复初始化） */
let initialized = false

/** 延迟初始化：在应用启动时调用，避免循环依赖 */
export function ensureBuiltinRoles(): void {
  if (initialized) return
  initialized = true
  initBuiltinRoles()
}