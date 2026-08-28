import type { RoleDef } from "./types"

/**
 * 内置 11 个角色定义（从 logic.ts / GamePanel.vue 散落常量迁移而来，行为语义不变）。
 * 新增角色：往下方数组追加一条 RoleDef 即可，核心流程代码无需改动。
 */
export const BUILTIN_ROLES: RoleDef[] = [
  { id: "狼人", camp: "wolf", unique: false, emoji: "🐺", short: "狼" },
  { id: "白狼王", camp: "wolf", unique: true, emoji: "❄️🐺", short: "白狼" },
  { id: "狼王", camp: "wolf", unique: true, emoji: "🔫🐺", short: "狼王" },
  { id: "预言家", camp: "god", unique: true, emoji: "🔮", short: "预" },
  { id: "女巫", camp: "god", unique: true, emoji: "🧙", short: "巫" },
  { id: "猎人", camp: "god", unique: true, emoji: "🔫", short: "猎" },
  { id: "守卫", camp: "god", unique: true, emoji: "🛡️", short: "守" },
  { id: "骑士", camp: "god", unique: true, emoji: "⚔️", short: "骑" },
  { id: "白痴", camp: "god", unique: true, emoji: "🙊", short: "痴" },
  { id: "平民", camp: "villager", unique: false, emoji: "👤", short: "民" },
  { id: "丘比特", camp: "third", unique: true, emoji: "💘", short: "丘" },
]
