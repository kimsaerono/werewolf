#!/usr/bin/env bun
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync, cpSync, rmSync, readdirSync } from "node:fs"
import { join } from "node:path"

function run(cmd: string, cwd?: string) {
  console.log(`$ ${cmd}`)
  execSync(cmd, { stdio: "inherit", cwd })
}

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

  // 记录当前分支，最后要切回来
  const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim()
  const currentCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()

  // 暂存工作区变更，避免切分支冲突
  run("git stash push -u -m 'build-all-versions auto-stash'")

  const versions: { version: string; path: string; tag: string; date: string }[] = []

  // 1. 构建 main 分支（最新版）-> dist/
  console.log("\n=== Building main (latest) ===")
  run("git checkout main")
  run("bun install")
  run("VITE_BASE=/werewolf/ bun run build")
  // 版本号
  const mainVersion = execSync("git describe --tags --always --dirty", { encoding: "utf-8" }).trim()
  versions.push({ version: mainVersion, path: "/werewolf/", tag: "main", date: new Date().toISOString() })

  // 2. 构建每个 stable-v* 标签 -> dist/vX.Y/
  for (const tag of tags) {
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

  // 3. 生成 versions.json 清单
  const manifest = {
    latest: mainVersion,
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