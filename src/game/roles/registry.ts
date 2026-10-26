import type { RoleDef } from "./types"
import { BUILTIN_ROLES } from "./builtin"

/** 全部角色定义（内置 + 运行时动态注册）。内部维护，外部通过下方查询函数访问。 */
const registry = new Map<string, RoleDef>()
BUILTIN_ROLES.forEach((r) => registry.set(r.id, r))

/** 注册（或覆盖）一个角色定义。新角色接入的唯一入口。 */
export function registerRole(def: RoleDef): void {
  registry.set(def.id, def)
}

/** 取消注册（主要供测试清理用）。 */
export function unregisterRole(id: string): void {
  registry.delete(id)
}

/** 按 id 取角色定义；未注册时返回 undefined。 */
export function getRole(id: string): RoleDef | undefined {
  return registry.get(id)
}

/** 有序角色 id 列表（按注册顺序），这与旧 ALL_ROLE_OPT 语义一致。 */
export function roleIds(): string[] {
  return [...registry.values()].map((r) => r.id)
}

/** 某角色是否注册。 */
export function isRegistered(id: string): boolean {
  return registry.has(id)
}
