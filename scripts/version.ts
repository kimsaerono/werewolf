#!/usr/bin/env bun
/**
 * 版本切换 CLI（UI 切换的兜底方案）。
 *
 * 用法：
 *   bun run version                 # 显示当前版本 + 可用版本
 *   bun run version stable-v1.2     # 切换到指定 tag
 */
import { execSync } from "node:child_process"

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim()
}

function runInherit(cmd: string): void {
  execSync(cmd, { stdio: "inherit" })
}

function current(): { version: string; commit: string; dirty: boolean } {
  const raw = run("git describe --tags --always --dirty")
  const dirty = raw.endsWith("-dirty")
  return {
    version: dirty ? raw.slice(0, -6) : raw,
    commit: run("git rev-parse --short HEAD"),
    dirty,
  }
}

function list(): string[] {
  const out: string[] = []
  const head = run("git rev-parse HEAD")
  for (const tag of run("git tag -l 'stable-v*' --sort=-v:refname").split("\n").filter(Boolean)) {
    const commit = run(`git rev-list -1 ${tag}`)
    out.push(`${tag}  ${commit.slice(0, 7)}${commit === head ? "  ← 当前" : ""}`)
  }
  return out
}

function main() {
  const args = process.argv.slice(2)
  const c = current()

  if (args.length === 0) {
    console.log(`当前版本: ${c.version} (${c.commit})${c.dirty ? " [有未提交变更]" : ""}`)
    console.log("\n可用版本:")
    for (const line of list()) console.log("  " + line)
    console.log("\n用法: bun run version <tag>")
    return
  }

  const target = args[0]
  const status = run("git status --porcelain")
  if (status) {
    console.error("❌ 存在未提交变更，请先提交或暂存后再切换。")
    process.exit(1)
  }

  console.log(`切换 ${c.version} → ${target} ...`)
  try {
    runInherit(`git checkout ${target}`)
  } catch {
    console.error(`❌ 切换失败：找不到 ${target}`)
    process.exit(1)
  }

  console.log(`✅ 已切换到 ${target}`)
  console.log("⚠️  请重启服务使新版本生效：")
  console.log("   - Ctrl+C 停止当前服务")
  console.log("   - 重新运行 bun run dev")
}

main()
