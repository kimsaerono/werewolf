import { ref, computed } from "vue"

const currentVersion = ref<string>("")
const availableVersions = ref<Array<{ label: string; value: string; current: boolean }>>([])
const loading = ref(false)
const error = ref<string | null>(null)

function parseVersion(raw: string): { label: string; short: string; commit: string; dirty: boolean } {
  const dirty = raw.endsWith("-dirty")
  const clean = dirty ? raw.slice(0, -6) : raw
  const parts = clean.split("-")
  let tag = parts[0]
  let distance = ""
  let commit = ""

  if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 2])) {
    distance = parts[parts.length - 2]
    commit = parts[parts.length - 1].replace("g", "")
    tag = parts.slice(0, -2).join("-")
  } else if (parts.length >= 2) {
    commit = parts[parts.length - 1].replace("g", "")
    tag = parts.slice(0, -1).join("-")
  }

  const semver = tag.replace(/^stable-v/, "v")
  const label = distance ? `${semver}-${distance}-g${commit}` : semver

  return { label, short: semver, commit: commit.slice(0, 7), dirty }
}

export function useVersion() {
  async function fetchVersions() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch("/api/version/list")
      if (!res.ok) throw new Error("获取版本列表失败")
      const data = await res.json()
      availableVersions.value = data.map((v: any) => ({
        label: v.isBranch ? `${v.tag} (分支)` : v.tag,
        value: v.tag,
        current: v.current,
      }))
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchCurrent() {
    try {
      const res = await fetch("/api/version/current")
      if (!res.ok) throw new Error("获取当前版本失败")
      const data = await res.json()
      currentVersion.value = data.version
    } catch {
      currentVersion.value = __APP_VERSION__ || "unknown"
    }
  }

  async function switchVersion(target: string) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch("/api/version/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "切换失败")
      return data
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  const parsed = computed(() => parseVersion(currentVersion.value || __APP_VERSION__))

  return {
    currentVersion,
    availableVersions,
    loading,
    error,
    parsed,
    fetchVersions,
    fetchCurrent,
    switchVersion,
  }
}