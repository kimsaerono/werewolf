/**
 * 用 edge-tts（微软免费神经语音，无需GPU）生成固定播报音频 → public/audio/<id>.mp3
 * 用法：bun run scripts/gen-voices-edge.ts
 * 生成后把末尾输出的映射填入 src/utils/speech.ts 的 SPEAK_AUDIO
 */
import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { VOICE_LINES } from "./voice-lines"

const OUT = fileURLToPath(new URL("../public/audio", import.meta.url))

/** 每条文案的 edge-tts 音色 + 音调（按角色/情感配） */
const EDGE: Record<string, { v: string; pitch?: string; rate?: string }> = {
  night_start: { v: "zh-CN-YunxiNeural", pitch: "-5Hz" },
  cupid: { v: "zh-CN-XiaoyiNeural", pitch: "+5Hz", rate: "-5%" },
  cupid_close: { v: "zh-CN-XiaoxiaoNeural" },
  wolf: { v: "zh-CN-YunxiNeural", pitch: "-18Hz" },
  wolf_close: { v: "zh-CN-YunxiNeural", pitch: "-8Hz" },
  wolf_king_gesture: { v: "zh-CN-YunxiNeural", pitch: "-10Hz" },
  prophet: { v: "zh-CN-YunyangNeural", pitch: "-4Hz" },
  prophet_close: { v: "zh-CN-YunyangNeural" },
  guard: { v: "zh-CN-YunyangNeural", pitch: "-8Hz" },
  guard_close: { v: "zh-CN-YunyangNeural" },
  witch: { v: "zh-CN-XiaoxiaoNeural", pitch: "-6Hz", rate: "-5%" },
  witch_close: { v: "zh-CN-XiaoxiaoNeural" },
  knight: { v: "zh-CN-YunjianNeural", pitch: "+4Hz" },
  knight_close: { v: "zh-CN-YunjianNeural" },
  hunter_open: { v: "zh-CN-YunjianNeural", pitch: "+8Hz" },
  hunter_close: { v: "zh-CN-YunjianNeural" },
  idiot_open: { v: "zh-CN-YunxiaNeural", pitch: "+8Hz" },
  idiot_close: { v: "zh-CN-YunxiaNeural" },
  dawn: { v: "zh-CN-XiaoxiaoNeural", pitch: "+12Hz", rate: "+5%" },
  dawn_peace: { v: "zh-CN-XiaoxiaoNeural", pitch: "+8Hz" },
  vote: { v: "zh-CN-XiaoxiaoNeural", pitch: "+2Hz" },
  explode: { v: "zh-CN-YunxiNeural", pitch: "+12Hz", rate: "+10%" },
  wwk_boom: { v: "zh-CN-YunxiNeural", pitch: "+16Hz", rate: "+10%" },
  hunter: { v: "zh-CN-YunjianNeural", pitch: "+12Hz", rate: "+5%" },
  hunter_poisoned: { v: "zh-CN-XiaoxiaoNeural", pitch: "-12Hz", rate: "-10%" },
  idiot_flip: { v: "zh-CN-YunxiaNeural", pitch: "+16Hz", rate: "+10%" },
  knight_duel_wolf: { v: "zh-CN-YunjianNeural", pitch: "+16Hz", rate: "+10%" },
  knight_duel_good: { v: "zh-CN-YunxiNeural", pitch: "-8Hz", rate: "-8%" },
  jinghui: { v: "zh-CN-YunyangNeural" },
  wolfkingShot: { v: "zh-CN-YunjianNeural", pitch: "+10Hz" },
  prophetReport: { v: "zh-CN-YunyangNeural" },
  speech: { v: "zh-CN-XiaoxiaoNeural", pitch: "+2Hz" },
}

function edgeBin(): string {
  try {
    return require("node:child_process").execFileSync("edge-tts", ["--version"], { stdio: "ignore" }) && "edge-tts"
  } catch {
    return "python3"
  }
}
function edgeArgs(text: string, cfg: { v: string; pitch?: string; rate?: string }): string[] {
  const base: string[] = []
  if (edgeBin() === "python3") base.push("-m", "edge_tts")
  const args = [
    ...base,
    "--voice", cfg.v,
    "--text", text,
    "--write-media", "-",
  ]
  if (cfg.pitch) args.push(`--pitch=${cfg.pitch}`)
  if (cfg.rate) args.push(`--rate=${cfg.rate}`)
  return args
}
function runEdge(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = edgeBin()
    const p = spawn(bin, args)
    const chunks: Buffer[] = []
    let err = ""
    p.stdout.on("data", (d: Buffer) => chunks.push(d))
    p.stderr.on("data", (d: Buffer) => (err += d.toString()))
    p.on("error", reject)
    p.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks))
      else reject(new Error(err.trim() || `edge-tts 退出码 ${code}`))
    })
  })
}
async function genOne(line: { id: string; text: string }, retry = 3): Promise<Buffer> {
  const cfg = EDGE[line.id] || { v: "zh-CN-XiaoxiaoNeural" }
  for (let i = 0; i < retry; i++) {
    try {
      return await runEdge(edgeArgs(line.text, cfg))
    } catch (e) {
      if (i === retry - 1) throw e
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  throw new Error("unreachable")
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const map: Record<string, string> = {}
  let ok = 0
  for (const line of VOICE_LINES) {
    try {
      const buf = await genOne(line)
      writeFileSync(`${OUT}/${line.id}.mp3`, buf)
      map[line.id] = `${line.id}.mp3`
      ok++
      console.log(`✓ ${line.id}: ${line.text.slice(0, 16)} → ${(buf.length / 1024).toFixed(0)}KB`)
    } catch (e) {
      console.error(`✗ ${line.id}: ${(e as Error).message}`)
    }
  }
  console.log(`\n已生成 ${ok}/${VOICE_LINES.length} → public/audio/`)
  console.log("\n==== 把下面内容填入 src/utils/speech.ts 的 SPEAK_AUDIO ====")
  console.log(JSON.stringify(map, null, 2))
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
