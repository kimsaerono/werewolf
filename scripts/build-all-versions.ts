#!/usr/bin/env bun
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync, cpSync, rmSync, readdirSync } from "node:fs"
import { join } from "node:path"

function run(cmd: string, cwd?: string) {
  console.log(`$ ${cmd}`)
  execSync(cmd, { stdio: "inherit", cwd })
}

/** 所有 stable-v* tag，按版本号降序（v1.11 在 v1.9 之前） */
function getTags(): string[] {
  try {
    const out = execSync("git tag -l 'stable-v*'", { encoding: "utf-8" })
    return out.trim().split("\n").filter(Boolean).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  } catch {
    return []
  }
}

function getVersionFromTag(tag: string): string {
  return tag.replace("stable-v", "")
}

async function main() {
  const repoRoot = process.cwd()
  const distDir = join(repoRoot, "dist")

  // 清理 dist
  if (existsSync(distDir)) rmSync(distDir, { recursive: true })
  mkdirSync(distDir, { recursive: true })

  const tags = getTags()
  console.log(`Found tags: ${tags.join(", ") || "none"}`)
  if (tags.length === 0) {
    console.error("❌ 未找到 stable-v* tag，无法确定最新版本；请先打 tag 再部署。")
    process.exit(1)
  }
  const newest = tags[0]

  // 记录当前分支，最后要切回来
  const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim()

  // 暂存工作区变更，避免切分支冲突
  run("git stash push -u -m 'build-all-versions auto-stash'")

  const versions: { version: string; path: string; tag: string; date: string }[] = []

  // 1. 最新 tag 构建到根目录（/werewolf/ 即最新稳定版）
  console.log(`\n=== Building ${newest} (latest) -> root ===`)
  run(`git checkout ${newest}`)
  run("bun install")
  run("VITE_BASE=/werewolf/ bun run build")
  versions.push({
    version: getVersionFromTag(newest),
    path: "/werewolf/",
    tag: newest,
    date: new Date().toISOString(),
  })

  // 2. 其余 tag 各构建到 dist/vX.Y/
  for (const tag of tags.slice(1)) {
    const version = getVersionFromTag(tag)
    const tempDir = join(repoRoot, `dist-temp-${version}`)
    const outDir = join(distDir, version)

    console.log(`\n=== Building ${tag} -> ${outDir} ===`)

    run(`git checkout ${tag}`)
    run("bun install")
    const base = `/werewolf/${version}/`
    // 直接构建到临时目录，避免污染主 dist/
    run(`VITE_BASE=${base} bun run build --outDir ${tempDir}`)

    // 将临时目录内容复制到最终位置
    if (existsSync(outDir)) rmSync(outDir, { recursive: true })
    mkdirSync(outDir, { recursive: true })
    for (const file of readdirSync(tempDir)) {
      cpSync(join(tempDir, file), join(outDir, file), { recursive: true })
    }
    // 清理临时目录
    rmSync(tempDir, { recursive: true })

    // 记录版本信息
    const tagDate = execSync(`git log -1 --format=%cI ${tag}`, { encoding: "utf-8" }).trim()
    versions.push({ version, path: base, tag, date: tagDate })
  }

  // 3. 生成 versions.json 清单（仅列 tag；root 代表最新 tag）
  const manifest = {
    versions: versions.sort((a, b) => b.date.localeCompare(a.date)),
  }
  writeFileSync(join(distDir, "versions.json"), JSON.stringify(manifest, null, 2))
  console.log("\n=== versions.json ===")
  console.log(JSON.stringify(manifest, null, 2))

  // 4. 切回原分支
  run(`git checkout ${currentBranch}`)
  // 恢复暂存的变更
  run("git stash pop || true")

  console.log("\n✅ All versions built to dist/")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
