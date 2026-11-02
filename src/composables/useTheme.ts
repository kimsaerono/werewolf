import { computed, ref, watch } from "vue"
import { ROLE_EMOJI, roleShort } from "@/game/logic"

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

/** 专场（主题皮肤）定义；新增专场只需在 SPECIALS 里加一条配置 */
export interface SpecialEvent {
  id: string
  name: string
  emoji: string
  desc: string
  /** 挂到 <html> 上的样式类（App.vue 全局 CSS 用） */
  themeClass: string
  /** 选人页容器样式类（ModeSelectPage 局部 CSS 用） */
  modeClass: string
  /** 选人页背景装饰表情 */
  modeDecor: string[]
  /** 主界面角标装饰表情 */
  appDecor: string[]
  /** 选人页 hero 文案 */
  hero: { logo: string; title: string; sub: string }
  /** 角色别称：只影响显示/播报，不影响内部角色名与飞书同步 */
  roleAliases?: Record<string, RoleAlias>
  /** themeText 的短语替换表（先于角色别称应用） */
  textMap?: Record<string, string>
  /** antd 主题 token（App.vue config-provider） */
  antdToken?: Record<string, string>
}

export const SPECIALS: SpecialEvent[] = [
  {
    id: "halloween",
    name: "万圣节专场",
    emoji: "🎃",
    desc: "南瓜、骷髅、暗夜配色；灵媒巫师 / 暗夜巫婆 / 亡灵猎手 / 古堡守灵人分别对应预言家 / 女巫 / 猎人 / 守卫",
    themeClass: "theme-halloween",
    modeClass: "mode-halloween",
    modeDecor: ["🎃", "💀", "🦇", "🕸️"],
    appDecor: ["🎃", "💀", "🦇", "🕸️", "🎃", "💀"],
    hero: { logo: "🎃", title: "万圣节狼人夜", sub: "灵媒巫师、暗夜巫婆、亡灵猎手与古堡守灵人已就位" },
    roleAliases: HALLOWEEN_ROLE_ALIASES,
    textMap: {
      "守卫守人": "古堡守灵人守夜",
      "守卫本晚不守护": "古堡守灵人本晚不守护",
      "算命大仙": "灵媒巫师",
      "药罐子女巫": "暗夜巫婆",
      "夜班保镖": "古堡守灵人",
      "枪哥": "亡灵猎手",
    },
    antdToken: { colorPrimary: "#ff7a18", colorInfo: "#ff7a18", colorLink: "#ffb347", colorBgBase: "#140f1f", colorTextBase: "#f5e9d0" },
  },
]

export type ThemeId = "classic" | (typeof SPECIALS)[number]["id"]

const STORAGE_KEY = "werewolf_theme"

let initial: ThemeId = "classic"
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (SPECIALS.some((s) => s.id === saved)) initial = saved as ThemeId
} catch {
  /* ignore */
}

const themeId = ref<ThemeId>(initial)

function applyThemeClass(v: ThemeId): void {
  if (typeof document === "undefined") return
  for (const s of SPECIALS) document.documentElement.classList.remove(s.themeClass)
  const active = SPECIALS.find((s) => s.id === v)
  if (active) document.documentElement.classList.add(active.themeClass)
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

/** 当前生效的专场；无专场时为 null（经典） */
export const activeSpecial = computed<SpecialEvent | null>(() => SPECIALS.find((s) => s.id === themeId.value) ?? null)

export function isHalloweenTheme(): boolean {
  return themeId.value === "halloween"
}

function aliasOf(role: string): RoleAlias | undefined {
  return activeSpecial.value?.roleAliases?.[role]
}

/** 专场角色全名（附原名，便于法官对照）；无专场时返回原名 */
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

/** 专场角色 emoji；没有别名时沿用原角色 emoji */
export function themeRoleEmoji(role: string): string {
  const alias = aliasOf(role)
  return alias ? alias.emoji : ROLE_EMOJI[role] || ""
}

/** 把一段界面文案里的原角色名替换成专场别称（不用于日志/飞书数据） */
export function themeText(text: string): string {
  const sp = activeSpecial.value
  if (!sp || !text) return text
  let out = text
  if (sp.textMap) {
    for (const [from, to] of Object.entries(sp.textMap)) out = out.split(from).join(to)
  }
  if (sp.roleAliases) {
    for (const [role, alias] of Object.entries(sp.roleAliases)) out = out.split(role).join(alias.name)
  }
  return out
}

export function useTheme() {
  const isHalloween = computed(() => themeId.value === "halloween")
  function setTheme(v: ThemeId) {
    themeId.value = v
  }
  function toggleTheme() {
    themeId.value = themeId.value === "classic" ? "halloween" : "classic"
  }
  return { themeId, isHalloween, activeSpecial, setTheme, toggleTheme }
}
