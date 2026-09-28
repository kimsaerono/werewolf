/** 「历赛季前三」存档与赛季清零构建器（纯函数，供本地桥接与测试共用）
 *
 * 「历赛季前三」tab 布局（2 列 A..B）：
 *   A赛季 │ B前三名
 *   表头第 1 行，数据第 2 行起。配置区：Z1=当前赛季 key（YYYY-Qn）。
 *
 * 赛季判定：自然季度（1-3/4-6/7-9/10-12 月），key 形如 2026-Q3。
 * 赛季命名：S1 初见·月下、S2 迷雾·深林、S3 破晓·刀光、S4 春风·真相…
 * 前三名单元格内换行：🏆1.姓名 +分\n🥈2.姓名 +分\n🥉3.姓名 +分
 */
import { fmtScore } from "./recordBlock"

/** 狼人杀 S 赛季命名库（按自然季度 Q3~Q2 循环） */
export const SEASON_DISPLAY_MAP: Record<string, string> = {
  "2026-Q3": "S1 初见·月下",
  "2026-Q4": "S2 迷雾·深林",
  "2027-Q1": "S3 破晓·刀光",
  "2027-Q2": "S4 春风·真相",
  "2027-Q3": "S5 赤月·狼烟",
  "2027-Q4": "S6 幽梦·剧场",
  "2028-Q1": "S7 寒夜·守望",
  "2028-Q2": "S8 曙光·裁决",
  "2028-Q3": "S9 星河·誓约",
  "2028-Q4": "S10 终局·传说",
}

/** 季度 key：YYYY-Qn（空/解析失败返回 ""） */
export function quarterKeyOf(date: string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

/** 季度展示文案：优先查映射表，无则回退 YYYY年Qn */
export function quarterLabel(key: string): string {
  return SEASON_DISPLAY_MAP[key] ?? (() => {
    const m = key.match(/^(\d{4})-Q([1-4])$/)
    return m ? `${m[1]}年Q${m[2]}` : key || "-"
  })()
}

/** 季比较：a 是否晚于 b（YYYY-Qn） */
export function quarterLater(a: string, b: string): boolean {
  const ma = a.match(/^(\d{4})-Q([1-4])$/)
  const mb = b.match(/^(\d{4})-Q([1-4])$/)
  if (!ma || !mb) return false
  return Number(ma[1]) * 4 + Number(ma[2]) > Number(mb[1]) * 4 + Number(mb[2])
}

/** 「历赛季前三」表头行（2 列） */
export function archiveHeaderRow(): string[] {
  return ["赛季", "前三名"]
}

/** 配置区：当前赛季 key 存 Z1（远端不干扰 A/B） */
export const CONFIG_SEASON_CELL = "Z1"
export const CONFIG_SEASON_LABEL = "当前赛季"

/** 从「历赛季前三」读回的行数组中取当前赛季 key（rows[0] 为表头行，Z1 即 index 25） */
export function readConfigSeason(rows: (string | number)[][]): string {
  return String(rows[0]?.[25] ?? "").trim() || ""
}

/** 排名行 → 按总积分(G, index 6)降序取前三；返回 [{name, score}] */
export function topThree(rows: (string | number)[][]): { name: string; score: number }[] {
  return rows
    .map((r) => ({ name: String(r?.[1] ?? "").trim(), score: Number(r?.[6] ?? 0) || 0 }))
    .filter((r) => r.name)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh"))
    .slice(0, 3)
}

/** 构造「历赛季前三」存档行（2 列）：赛季 / 前三名（单元格内换行） */
export function archiveRowFor(rows: (string | number)[][], quarterKey: string, archiveTime: string): string[] {
  const t3 = topThree(rows)
  const medals = ["🏆", "🥈", "🥉"]
  const lines = t3.map((p, i) => `${medals[i]}${i + 1}.${p.name} ${fmtScore(p.score)}`).join("\n")
  return [quarterLabel(quarterKey), lines || "-"]
}

/** 赛季清零：保留表头行与 A 排名/B 昵称/H..K 原有值，C 场次 D 胜 E 负 F 胜率 G 积分 归零，数据行排名重排为 1..N
 *  入参为完整行数组（rows[0] 须为表头行，原样保留）。 */
export function rankResetRows(rows: (string | number)[][]): string[][] {
  const out: string[][] = []
  const cell = (v: unknown) => String(v ?? "")
  let rank = 0
  rows.forEach((r, i) => {
    if (i === 0) {
      out.push(rows[0].map(cell))
      return
    }
    if (!String(r?.[1] ?? "").trim()) return
    rank++
    out.push([String(rank), cell(r[1]), "0", "0", "0", "0%", "0", cell(r[7]), cell(r[8]), cell(r[9]), cell(r[10])])
  })
  return out
}