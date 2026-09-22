import { spawn } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const GROUP_ID = "oc_336d1cd3a4eb1ea9187d4114dd616fc8"
const OUT = fileURLToPath(new URL("../public/werewolf-members.json", import.meta.url))

function larkBin(): string {
  const local = fileURLToPath(new URL("../node_modules/.bin/lark-cli", import.meta.url))
  return existsSync(local) ? local : "lark-cli"
}

function runLark(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const p = spawn(larkBin(), args, { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    p.stdout.on("data", (d: Buffer) => (out += d.toString()))
    p.stderr.on("data", (d: Buffer) => (err += d.toString()))
    p.on("error", reject)
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(err.trim() || `lark-cli 退出码 ${code}`))
      try {
        const idx = out.indexOf("{")
        resolve(JSON.parse(idx >= 0 ? out.slice(idx) : out))
      } catch (e) {
        reject(e)
      }
    })
  })
}

const r = await runLark([
  "im",
  "+chat-members-list",
  "--chat-id",
  GROUP_ID,
  "--member-types",
  "user",
  "--page-all",
  "--format",
  "json",
])

if (!r?.ok) throw new Error(r?.error?.message || "获取成员失败")
const users: any[] = r.data?.users ?? []
const names = users.map((u) => u.name)
mkdirSync(fileURLToPath(new URL("../public", import.meta.url)), { recursive: true })
writeFileSync(OUT, JSON.stringify(names, null, 2) + "\n")
console.log(`✅ 已生成 ${OUT}，共 ${names.length} 名成员`)
