const modules = import.meta.glob("./*.png", { eager: true, import: "default" }) as Record<string, string>

/** 角色图片头像；无对应图片时返回空串（调用方回退到 emoji） */
export function roleAvatar(role: string): string {
  return modules[`./${role}.png`] || ""
}
