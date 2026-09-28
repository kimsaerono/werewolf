/** 汇元狼人杀群 chat_id（仅本地同步脚本使用，线上走静态快照） */
export const WEREWOLF_GROUP_ID = "oc_336d1cd3a4eb1ea9187d4114dd616fc8"

/** 从静态快照读取群成员（GitHub Pages 直接托管，无需后端） */
export async function getWerewolfGroupMembers(): Promise<string[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}werewolf-members.json`)
  if (!res.ok) throw new Error(`获取成员失败 ${res.status}（快照不存在？）`)
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error("成员快照格式错误")
  return data.filter((n): n is string => typeof n === "string")
}
