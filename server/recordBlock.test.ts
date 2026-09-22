import { describe, it, expect } from "bun:test"
import {
  RECORD_COLS,
  monthKeyOf,
  monthTabTitle,
  fmtScore,
  headerRow,
  gameRow,
  HEADER_MERGES,
  rowMerges,
  csvCell,
  rowToCsv,
  buildMonthInitOps,
  buildGameRowOps,
} from "./recordBlock"
import {
  quarterKeyOf,
  quarterLabel,
  quarterLater,
  archiveHeaderRow,
  readConfigSeason,
  topThree,
  archiveRowFor,
  rankResetRows,
  CONFIG_SEASON_CELL,
  CONFIG_SEASON_LABEL,
} from "./seasonArchive"
import type { SyncPayload } from "../src/api/feishuSync"

function payload(over: Partial<SyncPayload> = {}): SyncPayload {
  return {
    gameId: "真实·第1局 · 2026年8月21日",
    date: "2026/8/21 12:33:54",
    board: "8a",
    boardFinal: "狼人×3 预言家×1 女巫×1 平民×3",
    winCamp: "wolf",
    winner: "狼人胜利",
    reason: "屠边",
    judgeScore: 0.5,
    mvp: "武战峰",
    svp: "",
    beiguo: "赵妍",
    logLines: ["✅本局开始：发牌", "🌙第1晚：狼人刀了 1.赵妍(女巫)"],
    judge: { name: "王童", score: 0.5 },
    players: [
      { no: 1, name: "赵妍", role: "女巫", camp: "神职", win: false, base: 0, skill: -0.5, vote: 0 },
      { no: 2, name: "武战峰", role: "狼人", camp: "狼人", win: true, base: 3, skill: 0.5, vote: 0 },
    ],
    ...over,
  }
}

describe("recordBlock 表格版", () => {
  it("月份 key 与 tab 标题", () => {
    expect(monthKeyOf("2026/8/21 12:33:54")).toBe("2026-08")
    expect(monthKeyOf("2026-09-05T10:00:00")).toBe("2026-09")
    expect(monthTabTitle("2026/9/5")).toBe("2026-09复盘")
    expect(monthKeyOf("abc")).toBe("")
    expect(monthTabTitle("abc")).toBe("未知月复盘")
  })

  it("fmtScore：保留 1 位、正数带符号", () => {
    expect(fmtScore(0)).toBe("0.0")
    expect(fmtScore(3.5)).toBe("+3.5")
    expect(fmtScore(-0.5)).toBe("-0.5")
    expect(fmtScore(2.34)).toBe("+2.3")
    expect(fmtScore(-2.35)).toBe("-2.3")
  })

  it("表头：14 列，合并格值在 H/J，留 N", () => {
    const h = headerRow()
    expect(h).toHaveLength(RECORD_COLS)
    expect(h[0]).toBe("局次")
    expect(h[1]).toBe("时间")
    expect(h[2]).toBe("板子")
    expect(h[3]).toBe("胜负")
    expect(h[4]).toBe("原因")
    expect(h[5]).toBe("法官")
    expect(h[6]).toBe("荣誉")
    expect(h[7]).toBe("玩家积分")
    expect(h[9]).toBe("对局日志")
    expect(h[13]).toBe("")
  })

  it("数据行：14 列，字段落在各列；积分在 H、日志在 J", () => {
    const r = gameRow(payload())
    expect(r).toHaveLength(RECORD_COLS)
    expect(r[0]).toBe("真实·第1局 · 2026年8月21日")
    expect(r[1]).toBe("2026/8/21 12:33:54")
    expect(r[2]).toBe("狼人×3 预言家×1 女巫×1 平民×3")
    expect(r[3]).toBe("狼人胜利")
    expect(r[4]).toBe("屠边")
    expect(r[5]).toBe("王童")
    expect(r[6]).toBe("MVP:武战峰　背锅侠:赵妍")
    expect(r[7]).toContain("1.赵妍(女巫) -0.5")
    expect(r[7]).toContain("2.武战峰(狼人) +3.5")
    expect(r[9]).toBe("1. ✅本局开始：发牌\n2. 🌙第1晚：狼人刀了 1.赵妍(女巫)")
    expect(r[8]).toBe("")
    expect(r[13]).toBe("")
  })

  it("兜底：板子/法官/荣誉/积分/日志缺失不炸、占位为 -", () => {
    const r = gameRow(payload({ boardFinal: "", winner: undefined, judge: null, mvp: "", svp: "", beiguo: "", players: [], logLines: [] }))
    expect(r[2]).toBe("8a")
    expect(r[3]).toBe("-")
    expect(r[5]).toBe("-")
    expect(r[6]).toBe("-")
    expect(r[7]).toBe("")
    expect(r[9]).toBe("")
  })

  it("board 空时板子走 -", () => {
    expect(gameRow(payload({ board: "", boardFinal: "" }))[2]).toBe("-")
  })

  it("合并范围：表头 H1:I1 + J1:N1；数据行 H..N", () => {
    expect(HEADER_MERGES).toEqual(["H1:I1", "J1:N1"])
    expect(rowMerges(7)).toEqual(["H7:I7", "J7:N7"])
  })

  it("csvCell / rowToCsv：整格引号包裹 + 内部引号翻倍", () => {
    expect(csvCell('他说"天黑"')).toBe('"他说""天黑"""')
    expect(rowToCsv(["a", 'b"c'])).toBe('"a","b""c"')
  })

  it("buildMonthInitOps：合并×2 + 表头样式 + 列宽 + 行高 + 冻结，共 6 op，sheet_id 注入", () => {
    const ops = buildMonthInitOps("SHEET_X")
    expect(ops).toHaveLength(6)
    const sh = ops.map((o) => o.input.sheet_id)
    expect(sh.every((s) => s === "SHEET_X")).toBe(true)
    expect(ops.filter((o) => o.shortcut === "+cells-merge")).toHaveLength(2)
    const style = ops.find((o) => o.shortcut === "+cells-set-style")!
    expect(style.input.range).toBe("A1:N1")
    expect(style.input.background_color).toBe("#1668dc")
    expect(style.input.font_weight).toBe("bold")
    const cols = ops.find((o) => o.shortcut === "+cols-resize")!
    expect(cols.input.widths).toContain('"H:I":220')
    const freeze = ops.find((o) => o.shortcut === "+dim-freeze")!
    expect(freeze.input).toEqual({ sheet_id: "SHEET_X", dimension: "row", count: 1 })
  })

  it("buildGameRowOps：合并×2 + 网格边框 + 换行样式 + 行高 auto，共 5 op", () => {
    const ops = buildGameRowOps("S", 12)
    expect(ops.map((o) => o.shortcut)).toEqual([
      "+cells-merge",
      "+cells-merge",
      "+cells-set-style",
      "+cells-set-style",
      "+rows-resize",
    ])
    const mergeRanges = ops.filter((o) => o.shortcut === "+cells-merge").map((o) => o.input.range)
    expect(mergeRanges).toEqual(["H12:I12", "J12:N12"])
    const border = ops.filter((o) => o.shortcut === "+cells-set-style")[0]
    expect(border.input.range).toBe("A12:N12")
    expect(border.input.border_styles).toContain("#e5e7eb")
    const wrap = ops.filter((o) => o.shortcut === "+cells-set-style")[1]
    expect(wrap.input.range).toBe("H12:N12")
    expect(wrap.input.word_wrap).toBe("auto-wrap")
    const resize = ops.find((o) => o.shortcut === "+rows-resize")!
    expect(resize.input.range).toBe("12:12")
    expect(resize.input.type).toBe("auto")
  })
})

describe("seasonArchive 季度存档", () => {
  it("quarterKeyOf：自然季度", () => {
    expect(quarterKeyOf("2026/1/15")).toBe("2026-Q1")
    expect(quarterKeyOf("2026/3/31")).toBe("2026-Q1")
    expect(quarterKeyOf("2026/4/1")).toBe("2026-Q2")
    expect(quarterKeyOf("2026/8/21")).toBe("2026-Q3")
    expect(quarterKeyOf("2026/12/24")).toBe("2026-Q4")
    expect(quarterKeyOf("abc")).toBe("")
  })

  it("quarterLabel 与 quarterLater", () => {
    expect(quarterLabel("2026-Q3")).toBe("2026年Q3")
    expect(quarterLabel("")).toBe("-")
    expect(quarterLater("2026-Q4", "2026-Q3")).toBe(true)
    expect(quarterLater("2027-Q1", "2026-Q4")).toBe(true)
    expect(quarterLater("2026-Q3", "2026-Q4")).toBe(false)
    expect(quarterLater("2026-Q3", "2026-Q3")).toBe(false)
    expect(quarterLater("bad", "2026-Q3")).toBe(false)
  })

  it("表头 8 列 + 配置区常量", () => {
    expect(archiveHeaderRow()).toEqual(["赛季", "存档时间", "冠军", "冠军积分", "亚军", "亚军积分", "季军", "季军积分"])
    expect(CONFIG_SEASON_CELL).toBe("J1")
    expect(CONFIG_SEASON_LABEL).toBe("当前赛季")
  })

  it("readConfigSeason：J1 即 rows[0][9]", () => {
    expect(readConfigSeason([])).toBe("")
    const rows = Array.from({ length: 10 }, () => [])
    rows[0] = ["赛季", "存档时间", "冠军", "冠军积分", "亚军", "亚军积分", "季军", "季军积分", "当前赛季", "2026-Q3"]
    expect(readConfigSeason(rows)).toBe("2026-Q3")
  })

  it("topThree：按总积分(G)降序取前三，过滤空名", () => {
    const rows = [
      [1, "甲", 1, 1, 0, "100%", 3],
      [2, "乙", 1, 0, 1, "0%", 8],
      [3, "丙", 1, 0, 1, "0%", 5],
      [4, "丁", 0, 0, 0, "0%", 1],
      [5, "", 0, 0, 0, "0%", 99],
    ]
    expect(topThree(rows)).toEqual([
      { name: "乙", score: 8 },
      { name: "丙", score: 5 },
      { name: "甲", score: 3 },
    ])
  })

  it("archiveRowFor：赛季 + 时间 + 冠亚季军及积分", () => {
    const rows = [
      [1, "甲", 3, 3, 0, "100%", 6],
      [2, "乙", 3, 1, 2, "33%", 4],
      [3, "丙", 3, 2, 1, "67%", 2],
      [4, "丁", 3, 1, 2, "33%", 0.5],
    ]
    expect(archiveRowFor(rows, "2026-Q3", "2026年10月1日 09:00:00")).toEqual([
      "2026年Q3",
      "2026年10月1日 09:00:00",
      "甲",
      "+6.0",
      "乙",
      "+4.0",
      "丙",
      "+2.0",
    ])
  })

  it("archiveRowFor：空表/单人或同分回退 - 与 zh 排序稳定", () => {
    expect(archiveRowFor([], "2026-Q1", "t")).toEqual(["2026年Q1", "t", "-", "-", "-", "-", "-", "-"])
    const rows = [[1, "李", 1, 0, 1, "0%", 5], [2, "王", 1, 0, 1, "0%", 5]]
    const line = archiveRowFor(rows, "2026-Q2", "t")
    expect(line[2]).toBe("李")
    expect(line[4]).toBe("王")
  })

  it("rankResetRows：保留表头、数据行场次/胜/负/胜率/积分清零、排名重排、H..K 保留", () => {
    const rows = [
      ["排名", "昵称", "场次", "胜", "负", "胜率", "积分", "备注1", "备注2", "备注3", "备注4"],
      [1, "甲", 10, 8, 2, "80%", 23.5, "x", "y", "z", "w"],
      [2, "乙", 5, 3, 2, "60%", 12, "a", "b", "c", "d"],
      [3, "", 0, 0, 0, "", 0, "", "", "", ""],
    ]
    expect(rankResetRows(rows)).toEqual([
      ["排名", "昵称", "场次", "胜", "负", "胜率", "积分", "备注1", "备注2", "备注3", "备注4"],
      ["1", "甲", "0", "0", "0", "0%", "0", "x", "y", "z", "w"],
      ["2", "乙", "0", "0", "0", "0%", "0", "a", "b", "c", "d"],
    ])
  })
})

describe("部署端 cjs 一致性", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rb = require("../deploy/werewolf-sync/record-block.cjs") as {
    RECORD_COLS: number
    monthKeyOf: typeof monthKeyOf
    monthTabTitle: typeof monthTabTitle
    fmtScore: typeof fmtScore
    headerRow: typeof headerRow
    gameRow: typeof gameRow
    HEADER_MERGES: string[]
    rowMerges: typeof rowMerges
    csvCell: typeof csvCell
    rowToCsv: typeof rowToCsv
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sa = require("../deploy/werewolf-sync/season-archive.cjs") as {
    quarterKeyOf: typeof quarterKeyOf
    quarterLabel: typeof quarterLabel
    quarterLater: typeof quarterLater
    archiveHeaderRow: typeof archiveHeaderRow
    readConfigSeason: typeof readConfigSeason
    topThree: typeof topThree
    archiveRowFor: typeof archiveRowFor
    rankResetRows: typeof rankResetRows
    CONFIG_SEASON_CELL: string
    CONFIG_SEASON_LABEL: string
  }

  it("record-block.cjs 与 TS 版逐字段一致", () => {
    const p = payload()
    expect(rb.RECORD_COLS).toBe(RECORD_COLS)
    expect(rb.HEADER_MERGES).toEqual(HEADER_MERGES)
    expect(rb.monthKeyOf("2026/8/21")).toBe(monthKeyOf("2026/8/21"))
    expect(rb.monthTabTitle("2026/8/21")).toBe(monthTabTitle("2026/8/21"))
    expect(rb.headerRow()).toEqual(headerRow())
    expect(rb.gameRow(p)).toEqual(gameRow(p))
    expect(rb.rowMerges(9)).toEqual(rowMerges(9))
    expect(rb.csvCell('a"b')).toBe(csvCell('a"b'))
    expect(rb.rowToCsv(["a", "b"])).toBe(rowToCsv(["a", "b"]))
    for (const n of [0, 0.05, -0.5, 3.5, 2.34, -2.35, 10]) expect(rb.fmtScore(n)).toBe(fmtScore(n))
  })

  it("record-block.cjs 兜底与 TS 版一致", () => {
    const p = payload({ board: "", boardFinal: "", winner: undefined, judge: null, mvp: "", svp: "", beiguo: "", players: [], logLines: [] })
    expect(rb.gameRow(p)).toEqual(gameRow(p))
  })

  it("season-archive.cjs 与 TS 版一致", () => {
    const rows = [
      ["排名", "昵称", "场次", "胜", "负", "胜率", "积分"],
      [1, "甲", 10, 8, 2, "80%", 23.5],
      [2, "乙", 5, 3, 2, "60%", 12],
    ]
    expect(sa.quarterKeyOf("2026/8/21")).toBe(quarterKeyOf("2026/8/21"))
    expect(sa.quarterKeyOf("2026/12/24")).toBe(quarterKeyOf("2026/12/24"))
    expect(sa.quarterLater("2026-Q4", "2026-Q3")).toBe(quarterLater("2026-Q4", "2026-Q3"))
    expect(sa.quarterLater("2026-Q2", "2026-Q3")).toBe(quarterLater("2026-Q2", "2026-Q3"))
    expect(sa.archiveHeaderRow()).toEqual(archiveHeaderRow())
    expect(sa.CONFIG_SEASON_CELL).toBe(CONFIG_SEASON_CELL)
    expect(sa.CONFIG_SEASON_LABEL).toBe(CONFIG_SEASON_LABEL)
    expect(sa.readConfigSeason(rows)).toBe(readConfigSeason(rows))
    expect(sa.topThree(rows)).toEqual(topThree(rows))
    expect(sa.archiveRowFor(rows, "2026-Q3", "t")).toEqual(archiveRowFor(rows, "2026-Q3", "t"))
    expect(sa.rankResetRows(rows)).toEqual(rankResetRows(rows))
  })
})