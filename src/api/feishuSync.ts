/** 飞书表格同步（本地桥接方案）
 * 法官电脑浏览器 → H5 → fetch 本地桥接(localhost:3457) → lark-cli → 飞书表格
 * - dev 环境走 vite 代理 `/api` → localhost:3457
 * - 生产环境（GitHub Pages）可配 VITE_SYNC_URL=http://localhost:3457 让本机浏览器可用
 */
import { isWolfRole, GOD_LIST } from "@/game/logic"
import type { GameRecord } from "@/composables/useGame"

// dev 时用相对 /api（vite 代理到本地 3457）；生产可配绝对 localhost 地址
const SYNC_URL = (import.meta.env.VITE_SYNC_URL as string | undefined) || ""
const SYNC_ENABLED = import.meta.env.DEV || !!SYNC_URL

export { SYNC_ENABLED }

export interface SyncPlayerRow {
  no: number
  name: string
  role: string
  camp: string
  win: boolean
  base: number
  skill: number
  vote: number
}

export interface SyncPayload {
  gameId: string
  date: string
  board: string
  winCamp: string
  players: SyncPlayerRow[]
}

/** 计算单个玩家的阵营与胜负、拆基础分/技能分（投票分已移除恒为 0） */
export function buildSyncPayload(record: GameRecord): SyncPayload {
  const winWolf = record.winner.includes("狼人")
  const winThird = record.winner.includes("第三方")
  return {
    gameId: record.title,
    date: record.time,
    board: record.board,
    winCamp: winWolf ? "wolf" : winThird ? "third" : "good",
    players: record.players.map((p) => {
      const wolf = isWolfRole(p.role)
      const god = GOD_LIST.includes(p.role)
      const camp = wolf ? "狼人" : god ? "神职" : p.role === "平民" ? "平民" : "第三方"
      const win = wolf ? winWolf : winThird ? p.role === "丘比特" || camp === "第三方" : !winWolf
      const detail = p.scoreDetail || []
      let base = 0
      let skill = 0
      for (const d of detail) {
        const num = Number(d.match(/([+-]?\d+(?:\.\d+)?)/)?.[1] ?? 0)
        if (/胜利|胜利\+/.test(d)) base += num
        else skill += num
      }
      if (base === 0 && detail.length === 0) {
        if (win) base = wolf ? 3 : god ? 3 : p.role === "平民" ? 2 : 3
      }
      return {
        no: p.no,
        name: p.name,
        role: p.role,
        camp,
        win,
        base: Math.round(base * 10) / 10,
        skill: Math.round(skill * 10) / 10,
        vote: 0,
      }
    }),
  }
}

function syncEndpoint(): string {
  // 生产配置了绝对地址（localhost）则用它，否则 dev 用相对 /api
  return SYNC_URL ? `${SYNC_URL}/api/sync-feishu` : "/api/sync-feishu"
}

/** 把本局复盘 + 积分同步到飞书（返回错误信息，成功返回 null） */
export async function syncGameToFeishu(record: GameRecord): Promise<string | null> {
  if (!SYNC_ENABLED) return "未启用飞书同步（本地桥接未运行）"
  const payload = buildSyncPayload(record)
  try {
    const res = await fetch(syncEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const t = await res.text()
      return `同步失败(${res.status})：${t.slice(0, 120)}`
    }
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!data.ok) return data.error || "同步失败"
    return null
  } catch (e) {
    return `同步请求异常：${(e as Error).message}（请确认本地桥接已启动：bun run server）`
  }
}

/** 拉取积分排名（预留） */
export async function fetchRanking(): Promise<unknown[]> {
  if (!SYNC_ENABLED) return []
  try {
    const res = await fetch(`${SYNC_URL || ""}/api/sync-feishu`)
    if (!res.ok) return []
    const data = (await res.json()) as { rows?: unknown[] }
    return data.rows || []
  } catch {
    return []
  }
}
