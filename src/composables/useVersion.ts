import { ref, computed } from "vue"

interface CurrentInfo {
  version: string
  commit: string
  dirty: boolean
}

const currentInfo = ref<CurrentInfo>({ version: "", commit: "", dirty: false })
const availableVersions = ref<Array<{ label: string; value: string; current: boolean }>>([])
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * 把 git describe 输出拆成「版本号 + 提交」：
 *   stable-v1.2                 → { label: v1.2, commit: "" }
 *   stable-v1.2-5-g792fad3      → { label: v1.2, commit: "792fad3" }
 *   main                        → { label: main, commit: "" }
 */
function parseLabel(raw: string): { label: string; commit: string } {
  const m = raw.match(/^(.*)-(\d+)-g([0-9a-f]+)$/)
  const base = m ? m[1] : raw
  const commit = m ? m[3] : ""
  const label = base.replace(/^stable-v/, "v")
  return { label, commit }
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
        label: v.isBranch ? `${v.version} (分支)` : v.version,
        value: v.version,
        current: !!v.current,
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
      currentInfo.value = { version: data.version, commit: data.commit || "", dirty: !!data.dirty }
    } catch {
      currentInfo.value = { version: __APP_VERSION__ || "unknown", commit: "", dirty: false }
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

  const parsed = computed(() => {
    const raw = currentInfo.value.version || __APP_VERSION__
    const { label, commit } = parseLabel(raw)
    return {
      label,
      commit: currentInfo.value.commit || commit,
      dirty: currentInfo.value.dirty,
    }
  })

  return {
    currentVersion: computed(() => currentInfo.value.version),
    availableVersions,
    loading,
    error,
    parsed,
    fetchVersions,
    fetchCurrent,
    switchVersion,
  }
}