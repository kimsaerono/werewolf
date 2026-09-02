const modules = import.meta.glob("./*.png", { eager: true, import: "default" }) as Record<string, string>
const svgModules = import.meta.glob("./*.svg", { eager: true, import: "default" }) as Record<string, string>

/** 角色图片头像；无对应图片时返回空串（调用方回退到 emoji） */
export function roleAvatar(role: string): string {
  return modules[`./${role}.png`] || ""
}

/** 所有默认头像 SVG 路径列表 */
const DEFAULT_AVATARS: string[] = Object.values(svgModules).filter(Boolean)

/** 随机获取一个默认头像（用于未分配角色的玩家） */
export function randomDefaultAvatar(): string {
  if (DEFAULT_AVATARS.length === 0) return ""
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]
}