import type { RoleDef } from "./types"
import { BaseRole } from "./base"
import { registerRole } from "./registry"
import { WerewolfRole } from "./werewolf"
import { WhiteWolfKingRole } from "./white-wolf-king"
import { WolfKingRole } from "./wolf-king"
import { WolfBeautyRole } from "./wolf-beauty"
import { DreadKnightRole } from "./dread-knight"
import { GargoyleRole } from "./gargoyle"
import { ProphetRole } from "./prophet"
import { WitchRole } from "./witch"
import { HunterRole } from "./hunter"
import { GuardRole } from "./guard"
import { KnightRole } from "./knight"
import { IdiotRole } from "./idiot"
import { GravekeeperRole } from "./gravekeeper"
import { VillagerRole } from "./villager"
import { CupidRole } from "./cupid"
import { HiddenWolfRole } from "./hidden-wolf"
import { NightmareRole } from "./nightmare"
import { BloodMoonRole } from "./blood-moon"
import { WolfHunterRole } from "./wolf-hunter"
import { DreamerRole } from "./dreamer"
import { WildChildRole } from "./wild-child"
import { BombermanRole } from "./bomberman"
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
      // 每夜都进入狼人环节（照常念台词，避免语音暗示）；是否有人睁眼/刀人由面板判断
      // 隐狼带刀时（狼群全灭只剩隐狼）也需要狼人环节
      enabled: (c) => c.boardRoles.some((r) => c.isWolfRole(r)),
    },
  },
  { id: "白狼王", camp: "wolf", unique: true, emoji: "❄️🐺", short: "白狼", intentKeys: [] },
  { id: "狼王", camp: "wolf", unique: true, emoji: "🔫🐺", short: "狼王", intentKeys: [] },
  // 隐狼：不与狼群见面，首夜单独认人；带刀后并入狼人环节
  {
    id: "隐狼", camp: "wolf", unique: true, emoji: "🐺🌫️", short: "隐狼", wolfPack: false, intentKeys: ["nightWolfKill"],
    nightStep: {
      order: 26, key: "hiddenWolf", label: "隐狼睁眼", emoji: "🐺",
      // 仅首夜出现：法官单独叫醒确认身份（不与狼群见面）
      enabled: (c) => c.round <= 1 && c.boardRoles.includes("隐狼") && !c.nightSteps.hiddenWolf,
    },
  },
  // 噩梦之影：每夜恐惧一人
  {
    id: "噩梦之影", camp: "wolf", unique: true, emoji: "😱", short: "噩梦", intentKeys: [],
    nightStep: { order: 28, key: "nightmare", label: "噩梦之影恐惧", emoji: "😱" },
  },
  // 血月使徒：普通带刀狼，自爆封印神职/仅剩狼时延迟出局（无独立夜间步骤）
  { id: "血月使徒", camp: "wolf", unique: true, emoji: "🌕", short: "血月", intentKeys: [] },
  {
    id: "狼美人", camp: "wolf", unique: true, emoji: "🌹", short: "狼美", intentKeys: ["nightWolfKill", "charmedName"],
    nightStep: { order: 35, key: "charm", label: "狼美人魅惑", emoji: "🌹", enabled: (c) => c.boardRoles.includes("狼美人") },
  },
  { id: "恶灵骑士", camp: "wolf", unique: true, emoji: "🛡️🐺", short: "恶骑", intentKeys: ["nightWolfKill"] },
  {
    id: "石像鬼", camp: "wolf", unique: true, emoji: "🗿", short: "石", wolfPack: false, intentKeys: ["nightWolfKill"],
    nightStep: {
      order: 25, key: "gargoyle", label: "石像鬼", emoji: "🗿",
      // 板子含石像鬼即每夜出现（照常念台词）；是否可验/可刀由面板判断
      enabled: (c) => c.boardRoles.includes("石像鬼") && !c.nightSteps.gargoyle,
    },
  },
  {
    id: "预言家", camp: "god", unique: true, emoji: "🔮", short: "预", intentKeys: ["nightProphetCheck"],
    nightStep: { order: 40, key: "prophet", label: "预言家验人", emoji: "🔮", enabled: (c) => c.boardRoles.includes("预言家") },
  },
  // 猎魔人：每夜狩猎一人，天亮结算；免疫女巫毒
  {
    id: "猎魔人", camp: "god", unique: true, emoji: "🗡️", short: "猎魔", intentKeys: [],
    nightStep: { order: 42, key: "hunterWolf", label: "猎魔人狩猎", emoji: "🗡️" },
  },
  // 摄梦人：每夜入梦一人（梦游者免疫夜间伤害），连续两晚同梦触发梦杀
  {
    id: "摄梦人", camp: "god", unique: true, emoji: "💭", short: "摄梦", intentKeys: [],
    nightStep: { order: 45, key: "dreamer", label: "摄梦人入梦", emoji: "💭" },
  },
  {
    id: "女巫", camp: "god", unique: true, emoji: "🧙", short: "巫", intentKeys: ["nightWitchSave", "nightWitchPoison", "nightUsedDrug"],
    nightStep: { order: 50, key: "witch", label: "女巫操作", emoji: "🧪" },
  },
  {
    id: "猎人", camp: "god", unique: true, emoji: "🔫", short: "猎", intentKeys: [],
    nightStep: { order: 80, key: "hunterOpen", label: "猎人睁眼", emoji: "🔫", enabled: (c) => c.boardRoles.includes("猎人") },
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
  {
    id: "守墓人", camp: "god", unique: true, emoji: "🪦", short: "墓", intentKeys: [],
    nightStep: {
      order: 55,
      key: "gravekeeper",
      label: "守墓人验尸",
      emoji: "🪦",
      // 板子含守墓人即每夜出现（照常念台词）；首夜仅确认，第二夜起读信息，死亡则走流程
      enabled: (c) => c.boardRoles.includes("守墓人") && !c.nightSteps.gravekeeper,
    },
  },
  { id: "平民", camp: "villager", unique: false, emoji: "👤", short: "民", intentKeys: [] },
  // 野孩子：首夜选榜样，榜样死后黑化为狼
  {
    id: "野孩子", camp: "villager", unique: true, emoji: "🌱", short: "野孩", intentKeys: [],
    nightStep: {
      order: 8, key: "wildChild", label: "野孩子选榜样", emoji: "🌱",
      // 仅首夜出现
      enabled: (c) => c.round <= 1 && c.boardRoles.includes("野孩子") && !c.nightSteps.wildChild,
    },
  },
  // 炸弹人：被放逐时引爆炸弹，全票放逐独赢
  {
    id: "炸弹人", camp: "third", unique: true, emoji: "💣", short: "炸弹", intentKeys: [],
    nightStep: {
      order: 85, key: "bomberOpen", label: "炸弹人睁眼", emoji: "💣",
      // 仅首夜：纯认人步骤（防止未认人被兜底成平民）
      enabled: (c) => c.round <= 1 && c.boardRoles.includes("炸弹人") && !c.nightSteps.bomberOpen,
    },
  },
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
    new WolfBeautyRole(),
    new DreadKnightRole(),
    new GargoyleRole(),
    new ProphetRole(),
    new WitchRole(),
    new HunterRole(),
    new GuardRole(),
    new KnightRole(),
    new IdiotRole(),
    new GravekeeperRole(),
    new VillagerRole(),
    new CupidRole(),
    new HiddenWolfRole(),
    new NightmareRole(),
    new BloodMoonRole(),
    new WolfHunterRole(),
    new DreamerRole(),
    new WildChildRole(),
    new BombermanRole(),
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