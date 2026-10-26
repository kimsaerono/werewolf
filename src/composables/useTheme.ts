import { computed, ref, watch } from "vue"
import { ROLE_EMOJI, roleShort } from "@/game/logic"

export type ThemeId = "classic" | "halloween"

const STORAGE_KEY = "werewolf_theme"

export interface RoleAlias {
  name: string
  short: string
  emoji: string
}

/** 万圣节专场角色别称：只影响显示/播报，不影响内部角色名与飞书同步 */
export const HALLOWEEN_ROLE_ALIASES: Record<string, RoleAlias> = {
  预言家: { name: "灵媒巫师", short: "灵媒", emoji: "🔮" },
  女巫: { name: "暗夜巫婆", short: "暗夜", emoji: "🧙‍♀️" },
  猎人: { name: "亡灵猎手", short: "亡灵", emoji: "🏹" },
  守卫: { name: "古堡守灵人", short: "守灵", emoji: "⚰️" },
}

let initial: ThemeId = "classic"
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === "halloween") initial = "halloween"
} catch {
  /* ignore */
}

const themeId = ref<ThemeId>(initial)

function applyThemeClass(v: ThemeId): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("theme-halloween", v === "halloween")
}

watch(
  themeId,
  (v) => {
    applyThemeClass(v)
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
  },
  { immediate: true },
)

export function isHalloweenTheme(): boolean {
  return themeId.value === "halloween"
}

function aliasOf(role: string): RoleAlias | undefined {
  return isHalloweenTheme() ? HALLOWEEN_ROLE_ALIASES[role] : undefined
}

/** 万圣节角色全名（附原名，便于法官对照）；非万圣节返回原名 */
export function themeRoleName(role: string): string {
  const alias = aliasOf(role)
  return alias ? `${alias.name}（${role}）` : role
}

/** 只显示别称（座位/紧凑标签用） */
export function themeRoleShortName(role: string): string {
  const alias = aliasOf(role)
  return alias ? alias.name : role
}

/** 紧凑短名 */
export function themeRoleShort(role: string): string {
  const alias = aliasOf(role)
  return alias ? alias.short : roleShort(role)
}

/** 主题角色 emoji；没有别名时沿用原角色 emoji */
export function themeRoleEmoji(role: string): string {
  const alias = aliasOf(role)
  return alias ? alias.emoji : ROLE_EMOJI[role] || ""
}

/** 把一段界面文案里的原角色名替换成万圣节别称（不用于日志/飞书数据） */
export function themeText(text: string): string {
  if (!isHalloweenTheme() || !text) return text
  let out = text
    // 避免「古堡守灵人守人」这类重复词，换成更自然的动作描述
    .split("守卫守人").join("古堡守灵人守夜")
    .split("守卫本晚不守护").join("古堡守灵人本晚不守护")
  for (const [role, alias] of Object.entries(HALLOWEEN_ROLE_ALIASES)) {
    out = out.split(role).join(alias.name)
  }
  return out
}

export function useTheme() {
  const isHalloween = computed(() => themeId.value === "halloween")
  function setTheme(v: ThemeId) {
    themeId.value = v
  }
  function toggleTheme() {
    themeId.value = themeId.value === "halloween" ? "classic" : "halloween"
  }
  return { themeId, isHalloween, setTheme, toggleTheme }
}
