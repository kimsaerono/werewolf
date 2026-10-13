<script setup lang="ts">
import { onMounted, ref, computed } from "vue"
import { Dropdown, Menu } from "ant-design-vue"

interface VersionInfo {
  version: string
  path: string
  tag: string
  date: string
}

interface Manifest {
  latest: string
  versions: VersionInfo[]
}

const versions = ref<VersionInfo[]>([])
const loading = ref(false)
const currentPath = ref("")

function getCurrentVersionPath(): string {
  const base = import.meta.env.BASE_URL || "/werewolf/"
  return base.replace(/\/+$/, "")
}

function getVersionLabel(v: VersionInfo): string {
  if (v.tag === "main") return `latest (${v.version})`
  return `v${v.version} (${v.tag})`
}

function isCurrent(v: VersionInfo): boolean {
  return v.path.replace(/\/+$/, "") === currentPath.value
}

async function loadManifest() {
  loading.value = true
  try {
    const base = import.meta.env.BASE_URL || "/werewolf/"
    const manifestUrl = `${base}versions.json`
    const resp = await fetch(manifestUrl, { cache: "no-store" })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const manifest: Manifest = await resp.json()
    versions.value = manifest.versions
    currentPath.value = getCurrentVersionPath()
    console.log("[StaticVersionSelector] loaded", manifest)
  } catch (e) {
    console.warn("[StaticVersionSelector] failed to load versions.json:", e)
    versions.value = []
  } finally {
    loading.value = false
  }
}

function navigateToVersion(v: VersionInfo) {
  if (isCurrent(v)) return
  window.location.href = v.path
}

const currentLabel = computed(() => {
  const base = import.meta.env.BASE_URL || "/werewolf/"
  if (base === "/werewolf/") return "latest"
  const match = base.match(/\/werewolf\/([^/]+)\//)
  return match ? `v${match[1]}` : "latest"
})

onMounted(() => {
  loadManifest()
})
</script>

<template>
  <a-tooltip :title="versions.length === 0 ? '单版本部署' : '点击切换已部署版本'">
    <Dropdown
      v-if="versions.length > 0 || loading"
      :trigger="['click']"
    >
      <a-button
        type="primary"
        size="small"
        :loading="loading"
        class="version-trigger"
        :disabled="versions.length === 0"
      >
        <span class="breath-dot"></span>
        <span class="version-text">{{ currentLabel }}</span>
        <span v-if="versions.length > 0" class="arrow">▼</span>
      </a-button>
      <template #overlay>
        <Menu :style="{ width: 240 }">
          <Menu.Item
            v-for="v in versions"
            :key="v.version"
            :disabled="isCurrent(v)"
            @click="navigateToVersion(v)"
          >
            <span class="item-label">{{ getVersionLabel(v) }}</span>
            <span v-if="isCurrent(v)" class="current-tag">当前</span>
          </Menu.Item>
          <Menu.Divider v-if="versions.length > 0" />
          <Menu.Item @click="loadManifest">
            <span class="icon">↻</span>
            <span>刷新版本列表</span>
          </Menu.Item>
        </Menu>
      </template>
    </Dropdown>

    <a-tag v-else class="version-badge">
      <span class="breath-dot"></span>
      <span class="version-text">{{ currentLabel || "加载中..." }}</span>
    </a-tag>
  </a-tooltip>
</template>

<style scoped>
.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  cursor: default;
}

.version-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.version-text {
  font-family: monospace;
  font-size: 12px;
  font-weight: 500;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breath-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.6);
  animation: breath 1.6s ease-in-out infinite;
}

@keyframes breath {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.5);
  }
  50% {
    opacity: 0.55;
    box-shadow: 0 0 0 4px rgba(82, 196, 26, 0);
  }
}

.arrow {
  font-size: 9px;
  opacity: 0.7;
}

.icon {
  font-size: 12px;
  opacity: 0.7;
}

.item-label {
  font-family: monospace;
  font-size: 12px;
}

.current-tag {
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 10px;
  color: #1677ff;
  background: rgba(22, 119, 255, 0.1);
  border-radius: 3px;
}
</style>