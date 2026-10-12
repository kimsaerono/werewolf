import { execSync } from "node:child_process"

export interface VersionInfo {
  version: string
  commit: string
  dirty: boolean
  date?: string
  isBranch?: boolean
  current?: boolean
}

export interface SwitchResult {
  success: boolean
  target: string
  needsRestart: boolean
  message?: string
  error?: string
}

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim()
}

export function getCurrentVersion(): VersionInfo {
  try {
    const raw = run("git describe --tags --always --dirty")
    const dirty = raw.endsWith("-dirty")
    const clean = dirty ? raw.slice(0, -6) : raw
    const commit = run("git rev-parse --short HEAD")
    const date = run("git log -1 --format=%ci")
    return { version: clean, commit, dirty, date }
  } catch {
    return { version: "unknown", commit: "", dirty: false }
  }
}

export function listVersions(): VersionInfo[] {
  const result: VersionInfo[] = []
  let headCommit = ""
  try {
    headCommit = run("git rev-parse HEAD")
  } catch {}

  try {
    const tags = run("git tag -l 'stable-v*' --sort=-v:refname")
    for (const tag of tags.split("\n").filter(Boolean)) {
      const commit = run(`git rev-list -1 ${tag}`)
      const date = run(`git log -1 --format=%ci ${tag}`)
      result.push({
        version: tag,
        commit: commit.slice(0, 7),
        dirty: false,
        date,
        isBranch: false,
        current: commit === headCommit,
      })
    }
  } catch {}

  return result
}

export function switchVersion(target: string): SwitchResult {
  try {
    const status = run("git status --porcelain")
    if (status) {
      return { success: false, target, needsRestart: false, error: "存在未提交变更，请先提交或暂存后再切换" }
    }

    let pkgBefore = ""
    let lockBefore = ""
    try {
      pkgBefore = run("git rev-parse HEAD:package.json")
    } catch {}
    try {
      lockBefore = run("git rev-parse HEAD:bun.lock")
    } catch {}

    run(`git checkout ${target}`)

    let pkgAfter = ""
    let lockAfter = ""
    try {
      pkgAfter = run("git rev-parse HEAD:package.json")
    } catch {}
    try {
      lockAfter = run("git rev-parse HEAD:bun.lock")
    } catch {}

    if (pkgBefore !== pkgAfter || lockBefore !== lockAfter) {
      run("bun install")
    }

    return {
      success: true,
      target,
      needsRestart: true,
      message: `已切换到 ${target}，需重启服务生效`,
    }
  } catch (e) {
    return {
      success: false,
      target,
      needsRestart: false,
      error: (e as Error).message,
    }
  }
}