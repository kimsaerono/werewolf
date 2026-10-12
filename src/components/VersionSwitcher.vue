<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue"
import { useVersion } from "@/composables/useVersion"
import { message, Modal } from "ant-design-vue"

const { currentVersion, availableVersions, loading, error, parsed, fetchVersions, fetchCurrent, switchVersion } = useVersion()

const currentLabel = computed(() => parsed.value.label)
const menuVisible = ref(false)
onMounted(async () => {
  await Promise.all([fetchCurrent(), fetchVersions()])
})

async function handleSwitch(target: string) {
  if (target === currentVersion.value) return

  try {
    await Modal.confirm({
      title: "确认切换版本",
      content: `确定切换到版本 ${target}？切换后需重启服务才能生效。`,
      okText: "切换",
      cancelText: "取消",
      okType: "danger",
    })

    const res = await switchVersion(target)
    if (res.needsRestart) {
      Modal.info({
        title: "切换完成，需重启服务",
        width: "min(560px, 92vw)",
        content: h("div", { style: "line-height: 1.8; font-size: 13px" }, [
          h("p", null, [
            "已切换到 ",
            h("b", null, target),
            "，代码已更新。",
          ]),
          h("p", { style: "margin-top: 8px" }, [h("b", null, "请手动重启服务：")]),
          h("ol", { style: "margin: 4px 0 0 18px; padding: 0" }, [
            h("li", null, ["在终端按 ", h("kbd", null, "Ctrl+C"), " 停止当前服务"]),
            h("li", null, ["重新运行 ", h("code", null, "bun run server")]),
          ]),
          h("p", { style: "margin-top: 8px; color: #888" }, "重启后版本将生效，对局状态会自动恢复。"),
        ]),
        okText: "知道了",
        onOk: () => window.location.reload(),
      })
    }
  } catch (e: any) {
    if (e !== "cancel") message.error(e.message || "切换失败")
  }
}

function handleMenuVisibleChange(visible: boolean) {
  menuVisible.value = visible
  if (visible) {
    fetchVersions()
  }
}

function handleRefresh() {
  window.location.reload()
}
</script>

<template>
  <a-dropdown
    :trigger="['click']"
    :open="menuVisible"
    @openChange="handleMenuVisibleChange"
  >
    <a-button type="primary" size="small" :loading="loading" class="version-trigger">
      <span class="breath-dot"></span>
      <span class="version-text">{{ currentLabel || "加载中..." }}</span>
      <span class="arrow">▼</span>
    </a-button>
    <template #overlay>
      <a-menu :style="{ width: 200 }">
        <a-menu-item
          v-for="v in availableVersions"
          :key="v.value"
          :disabled="v.current"
          @click="handleSwitch(v.value)"
        >
          <span class="item-label">{{ v.label }}</span>
          <span class="item-commit">{{ v.commit }}</span>
          <span v-if="v.current" class="current-tag">当前</span>
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item @click="handleRefresh">
          <span class="icon">↻</span>
          <span>刷新版本列表</span>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style scoped>
.version-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.version-text {
  font-family: monospace;
  font-size: 12px;
  font-weight: 500;
  max-width: 72px;
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

.item-commit {
  margin-left: 8px;
  font-family: monospace;
  font-size: 11px;
  opacity: 0.45;
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