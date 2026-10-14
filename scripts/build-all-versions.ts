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

// git describe 输出规范化：stable-v1.7 -> 1.7；领先最近 tag 时 stable-v1.7-3-gabc -> 1.7+dev
function normalizeVersion(v: string): string {
  const stripped = v.replace(/^stable-v/, "")
  if (/-\d+-g[0-9a-f]+$/i.test(stripped)) {
    return stripped.replace(/-\d+-g[0-9a-f]+$/i, "") + "+dev"
  }
  return stripped.replace(/-dirty$/, "")
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

  // 1. 构建 main 分支（最新版）-> dist/ 根目录
  console.log("\n=== Building main (latest) ===")
  run("git checkout main")
  const mainCommit = execSync("git rev-parse main", { encoding: "utf-8" }).trim()
  run("bun install")
  run("VITE_BASE=/werewolf/ bun run build")
  const mainDescribe = execSync("git describe --tags --always --dirty", { encoding: "utf-8" }).trim()
  // root 展示版本号：若 main 与某个 tag 指向同一提交，用该 tag 的版本号（下方循环会覆盖）
  let rootVersion = normalizeVersion(mainDescribe)

  // 2. 构建每个 stable-v* 标签 -> dist/vX.Y/
  for (const tag of tags) {
    const version = getVersionFromTag(tag)
    const tagCommit = execSync(`git rev-list -n 1 ${tag}`, { encoding: "utf-8" }).trim()

    if (tagCommit === mainCommit) {
      // 该 tag 与 main 完全相同，root 已提供同一构建，跳过子目录，避免重复
      console.log(`\n=== Skipping ${tag}: identical to main (root already serves it) ===`)
      rootVersion = version
      continue
    }

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

  // 3. 生成 versions.json 清单（root 代表 main/最新版）
  versions.push({ version: rootVersion, path: "/werewolf/", tag: "main", date: new Date().toISOString() })

  const manifest = {
    latest: rootVersion,
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