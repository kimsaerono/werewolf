import { ref, computed } from "vue"

interface CurrentInfo {
  version: string
  commit: string
  dirty: boolean
}

const currentInfo = ref<CurrentInfo>({ version: "", commit: "", dirty: false })
const availableVersions = ref<Array<{ label: string; value: string; commit: string; current: boolean }>>([])
const loading = ref(false)
const error = ref<string | null>(null)
/** 本地版本服务是否可用：null=未知，true=可用（可切换），false=不可用（静态托管，仅只读展示） */
const apiAvailable = ref<boolean | null>(null)

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
        label: v.version,
        value: v.version,
        commit: v.commit || "",
        current: !!v.current,
      }))
      apiAvailable.value = true
    } catch (e) {
      error.value = (e as Error).message
      apiAvailable.value = false
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
      if (apiAvailable.value === null) apiAvailable.value = true
    } catch {
      // 静态托管（GitHub Pages）无本地服务：回退到构建时注入的版本号，仅只读展示
      currentInfo.value = { version: __APP_VERSION__ || "unknown", commit: "", dirty: false }
      if (apiAvailable.value === null) apiAvailable.value = false
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
    apiAvailable,
    parsed,
    fetchVersions,
    fetchCurrent,
    switchVersion,
  }
}