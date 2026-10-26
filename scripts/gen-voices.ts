/**
 * 用 EmotiVoice（网易开源）生成固定播报音频，保存到 public/audio/<id>.mp3
 * 前置：本地/内网已启动 EmotiVoice OpenAI 兼容 API（uvicorn openaiapi:app，默认 :8000）
 * 用法：EMOTIVOICE_URL=http://127.0.0.1:8000 bun run scripts/gen-voices.ts
 * 生成后把末尾输出的映射填入 src/utils/speech.ts 的 SPEAK_AUDIO
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { VOICE_LINES } from "./voice-lines"

const HOST = process.env.EMOTIVOICE_URL || "http://127.0.0.1:8000"
const OUT = fileURLToPath(new URL("../public/audio", import.meta.url))

async function main() {
  mkdirSync(OUT, { recursive: true })
  const map: Record<string, string> = {}
  let okCount = 0
  for (const line of VOICE_LINES) {
    const url = `${HOST}/v1/audio/speech`
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: line.text,
          voice: line.voice,
          prompt: line.prompt,
          language: "zh_us",
          model: "emoti-voice",
          response_format: "mp3",
          speed: 1.0,
        }),
      })
    } catch (e) {
      console.error(`✗ ${line.id}: 请求失败 ${(e as Error).message}（请确认 EmotiVoice 已启动 ${HOST}）`)
      continue
    }
    if (!res.ok) {
      console.error(`✗ ${line.id}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`)
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(`${OUT}/${line.id}.mp3`, buf)
    map[line.id] = `${line.id}.mp3`
    okCount++
    console.log(`✓ ${line.id}: ${line.text.slice(0, 16)} → ${(buf.length / 1024).toFixed(0)}KB`)
  }
  console.log(`\n已生成 ${okCount}/${VOICE_LINES.length}`)
  console.log("\n==== 把下面内容填入 src/utils/speech.ts 的 SPEAK_AUDIO ====")
  console.log(JSON.stringify(map, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
