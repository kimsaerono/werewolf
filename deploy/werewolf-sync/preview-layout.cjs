/**
 * 月度复盘两种布局的临时 tab 预览渲染（本地执行，写真实工作簿的临时 tab，看完删除）
 * 用法: node preview-layout.cjs [env文件]
 */
"use strict"
const fs = require("fs")
const path = require("path")

const envFile = process.argv[2] || "/var/folders/p2/3t09hmp95dd_7vhwtz7spg280000gn/T/opencode/werewolf-real/env-server"
if (!fs.existsSync(envFile)) {
  console.error("找不到 env 文件:", envFile)
  process.exit(1)
}
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq > 0) {
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (process.env[k] === undefined) process.env[k] = v
  }
}

const { headerRow, gameRow } = require("./record-block.cjs")

function loadServer(layout) {
  process.env.LAYOUT_MODE = layout
  for (const k of Object.keys(require.cache)) {
    if (k.includes(path.join(__dirname, "server.cjs"))) delete require.cache[k]
  }
  return require("./server.cjs")
}

const SAMPLE = {
  gameId: "预览局 · 2026年9月20日",
  date: "2026/9/20 21:02:00",
  boardFinal: "狼人×2 女巫×1 猎人×1 平民×1",
  winner: "狼人胜利",
  reason: "屠边（好人均出局）",
  judge: { name: "郭欢欢", score: 0.5 },
  mvp: "王叶",
  svp: "冯婉婷",
  beiguo: "赵妍",
  logLines: [
    "✅ 发牌完成：1.王叶(狼人) 2.柴秀彬(平民) 3.冯婉婷(狼人) 4.赵妍(猎人) 5.武战峰(女巫) 6.曹恒盛(预言家)",
    "🌙 第1晚：狼人刀了 2.柴秀彬(平民)，女巫选择不用解药",
    "🌅 白天：2.柴秀彬(平民) 出局，遗言“我的银水 5.武战峰 是好人”，好人阵营一轮后开始怀疑 1.王叶",
    "🌙 第2晚：狼人刀了 5.武战峰(女巫)，女巫已无药；预言家查了 3.冯婉婷 → 狼人",
    "🌅 白天：5.武战峰(女巫) 出局，预言家 6.曹恒盛 报查杀，发言轮次激烈，猎人 4.赵妍 开麦带队",
    "🌙 第3晚：狼人刀了 6.曹恒盛(预言家)，预言家已验完 3.冯婉婷(狼人)、1.王叶(狼人)",
    "🌅 白天：6.曹恒盛(预言家) 出局，好人明确两狼，公投 3.冯婉婷 出局",
    "🌙 第4晚：狼人刀了 4.赵妍(猎人)，猎人出局前带 1.王叶 进场，剩 1 狼",
    "🌅 白天：好人对 1.狼人 归票成功，屠边（好人均出局），狼人胜利",
    "🏆 结论：本轮狼人刀法双夜破女巫药，好人视野混乱；MVP:1.王叶 ｜ SVP:3.冯婉婷 ｜ 背锅侠:4.赵妍",
  ],
  players: [
    { no: 1, name: "王叶", role: "狼人", camp: "狼人", win: true, base: 0, skill: 4, vote: 0 },
    { no: 2, name: "柴秀彬", role: "平民", camp: "平民", win: false, base: 0, skill: -2, vote: 0 },
    { no: 3, name: "冯婉婷", role: "狼人", camp: "狼人", win: true, base: 0, skill: 3, vote: 0 },
    { no: 4, name: "赵妍", role: "猎人", camp: "神职", win: false, base: 0, skill: -1.5, vote: 0 },
    { no: 5, name: "武战峰", role: "女巫", camp: "神职", win: false, base: 0, skill: -1, vote: 0 },
    { no: 6, name: "曹恒盛", role: "预言家", camp: "神职", win: false, base: 0, skill: 0, vote: 0 },
  ],
}

;(async () => {
  const srvA = loadServer("A")
  const token = await srvA.getTenantToken()
  // 清理历史预览 tab（v3 列表 + v3 删除）
  const listRes = await srvA.fetchJson(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${process.env.SPREADSHEET_TOKEN}/sheets/query`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  for (const s of (listRes.data && listRes.data.sheets) || []) {
    if (String(s.title || "").startsWith("布局") && String(s.title || "").endsWith("预览")) {
      const d = await srvA.fetchJson(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${process.env.SPREADSHEET_TOKEN}/sheets/${s.sheet_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      console.log(`清理旧预览 ${s.title}:`, d.code === 0 ? "OK" : d.code + " " + (d.msg || ""))
    }
  }
  const created = []
  for (const name of ["F"]) {
    const srv = loadServer(name)
    const t = await srv.getTenantToken()
    const title = `布局${name}预览`
    const sid = await srv.addSheet(token, title)
    await srv.initMonthTab(t, sid, "2026-09复盘")
    await srv.writeValues(t, sid, "A2", [gameRow(SAMPLE, name)])
    await srv.decorateGameRow(t, sid, 2)
    created.push({ title, sid })
    console.log(`已渲染布局${name}: ${title} (${sid})｜工作簿刷新查看`)
  }
  console.log("\n工作簿: https://9186.feishu.cn/sheets/" + process.env.SPREADSHEET_TOKEN)
  console.log("预览 tab:", created.map((c) => c.title).join("、"))
})()