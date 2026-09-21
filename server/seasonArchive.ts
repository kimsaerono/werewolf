/** 「历赛季前三」存档与赛季清零构建器（纯函数，供本地桥接与测试共用）
 *
 * 「历赛季前三」tab 布局（8 列 A..H）：
 *   A赛季 │ B存档时间 │ C冠军 │ D冠军积分 │ E亚军 │ F亚军积分 │ G季军 │ H季军积分
 *   表头第 1 行，数据第 2 行起。配置区：I1=固定标签"当前赛季"，J1=当前赛季 key（YYYY-Qn）。
 *
 * 赛季判定：自然季度（1-3/4-6/7-9/10-12 月），key 形如 2026-Q3。
 */
import { fmtScore } from "./recordBlock"

/** 季度 key：YYYY-Qn（空/解析失败返回 ""） */
export function quarterKeyOf(date: string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

/** 季度展示文案：2026年Q3 */
export function quarterLabel(key: string): string {
  const m = key.match(/^(\d{4})-Q([1-4])$/)
  return m ? `${m[1]}年Q${m[2]}` : key || "-"
}

/** 季比较：a 是否晚于 b（YYYY-Qn） */
export function quarterLater(a: string, b: string): boolean {
  const ma = a.match(/^(\d{4})-Q([1-4])$/)
  const mb = b.match(/^(\d{4})-Q([1-4])$/)
  if (!ma || !mb) return false
  return Number(ma[1]) * 4 + Number(ma[2]) > Number(mb[1]) * 4 + Number(mb[2])
}

/** 「历赛季前三」表头行（8 列） */
export function archiveHeaderRow(): string[] {
  return ["赛季", "存档时间", "冠军", "冠军积分", "亚军", "亚军积分", "季军", "季军积分"]
}

/** 配置区：当前赛季 key 所在格（值格 J1，标签 I1） */
export const CONFIG_SEASON_CELL = "J1"
export const CONFIG_SEASON_LABEL = "当前赛季"

/** 从「历赛季前三」读回的行数组中取当前赛季 key（rows[0] 为表头行，J1 即 index 9） */
export function readConfigSeason(rows: (string | number)[][]): string {
  return String(rows[0]?.[9] ?? "").trim() || ""
}

/** 排名行 → 按总积分(G, index 6)降序取前三；返回 [{name, score}] */
export function topThree(rows: (string | number)[][]): { name: string; score: number }[] {
  return rows
    .map((r) => ({ name: String(r?.[1] ?? "").trim(), score: Number(r?.[6] ?? 0) || 0 }))
    .filter((r) => r.name)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh"))
    .slice(0, 3)
}

/** 构造「历赛季前三」存档行（8 列）：赛季/存档时间/冠军/冠军积分/… */
export function archiveRowFor(rows: (string | number)[][], quarterKey: string, archiveTime: string): string[] {
  const t3 = topThree(rows)
  const [c, s, b] = [t3[0], t3[1], t3[2]] as ({ name: string; score: number } | undefined)[]
  return [
    quarterLabel(quarterKey),
    archiveTime,
    c?.name || "-",
    c ? fmtScore(c.score) : "-",
    s?.name || "-",
    s ? fmtScore(s.score) : "-",
    b?.name || "-",
    b ? fmtScore(b.score) : "-",
  ]
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