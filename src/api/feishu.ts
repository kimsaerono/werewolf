export interface FeishuChat {
  chat_id: string
  name: string
  member_count?: number
}

export interface FeishuMember {
  member_id: string
  name: string
}

/** 汇元狼人杀群 chat_id（硬编码，直接读取） */
export const WEREWOLF_GROUP_ID = "oc_336d1cd3a4eb1ea9187d4114dd616fc8"

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`请求失败 ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data as T
}

/** 获取指定飞书群成员（含昵称） */
export async function getGroupMembers(chatId: string): Promise<string[]> {
  const data = await getJson<{ users?: FeishuMember[] }>(`/api/members?chatId=${encodeURIComponent(chatId)}`)
  return (data.users ?? []).map((u) => u.name)
}

/** 获取汇元狼人杀群成员 */
export async function getWerewolfGroupMembers(): Promise<string[]> {
  return getGroupMembers(WEREWOLF_GROUP_ID)
}
