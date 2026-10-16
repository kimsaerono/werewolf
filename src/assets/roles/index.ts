// Vite 会把字面量 import.meta.glob(...) 静态替换成 import 对象，必须保持字面量形态。
// Bun/Node 没有 import.meta.glob，调用会抛错 —— 这里兜住，测试环境下退化为空图（调用方回退 emoji）。
let modules: Record<string, string> = {}
let svgModules: Record<string, string> = {}
try {
  modules = import.meta.glob("./*.png", { eager: true, import: "default" }) as Record<string, string>
  svgModules = import.meta.glob("./*.svg", { eager: true, import: "default" }) as Record<string, string>
} catch {
  // 非 Vite 运行环境：没有资源清单，按空处理
}

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