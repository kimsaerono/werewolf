<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useVersion } from "@/composables/useVersion"
import { message } from "ant-design-vue"

const { currentVersion, availableVersions, loading, parsed, fetchVersions, fetchCurrent, switchVersion } = useVersion()

const currentLabel = computed(() => parsed.value.label)
const menuVisible = ref(false)

// 底部半屏抽屉
const sheetVisible = ref(false)
const sheetState = ref<"confirm" | "result">("confirm")
const sheetTarget = ref("")
const switching = ref(false)

onMounted(async () => {
  await Promise.all([fetchCurrent(), fetchVersions()])
})

function handleMenuVisibleChange(visible: boolean) {
  menuVisible.value = visible
  if (visible) fetchVersions()
}

/** 点击 tag：先收起下拉，再滑出底部确认抽屉 */
function handleSwitch(target: string) {
  if (target === currentVersion.value) return
  menuVisible.value = false
  sheetTarget.value = target
  sheetState.value = "confirm"
  sheetVisible.value = true
}

async function confirmSwitch() {
  switching.value = true
  try {
    const res = await switchVersion(sheetTarget.value)
    if (res.needsRestart) {
      sheetState.value = "result"
    } else {
      message.error(res.error || "切换失败")
      sheetVisible.value = false
    }
  } catch (e: any) {
    message.error(e.message || "切换失败")
    sheetVisible.value = false
  } finally {
    switching.value = false
  }
}

function closeSheet() {
  sheetVisible.value = false
}

function reload() {
  window.location.reload()
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

  <!-- 底部上滑半屏抽屉 -->
  <a-drawer
    v-model:open="sheetVisible"
    placement="bottom"
    :height="sheetState === 'confirm' ? 260 : 340"
    :closable="false"
    root-class-name="version-sheet"
    :body-style="{ padding: 0 }"
  >
    <div class="sheet">
      <div class="sheet-handle"></div>

      <!-- 确认 -->
      <template v-if="sheetState === 'confirm'">
        <div class="sheet-title">确认切换版本</div>
        <div class="sheet-desc">
          确定切换到 <b class="hl">{{ sheetTarget }}</b> ？
          <br />
          切换后需<b>重启服务</b>才能生效。
        </div>
        <div class="sheet-actions">
          <a-button block size="large" @click="closeSheet">取消</a-button>
          <a-button block size="large" type="primary" danger :loading="switching" @click="confirmSwitch">切换</a-button>
        </div>
      </template>

      <!-- 完成 -->
      <template v-else>
        <div class="sheet-title">✅ 切换完成</div>
        <div class="sheet-desc">
          已切换到 <b class="hl">{{ sheetTarget }}</b>，代码已更新。
        </div>
        <div class="sheet-steps">
          <div class="sheet-steps-title">请手动重启服务：</div>
          <div class="sheet-step">1. 在终端按 <kbd>Ctrl+C</kbd> 停止当前服务</div>
          <div class="sheet-step">2. 重新运行 <code>bun run server</code></div>
          <div class="sheet-step-hint">重启后版本将生效，对局状态会自动恢复。</div>
        </div>
        <div class="sheet-actions">
          <a-button block size="large" type="primary" @click="reload">知道了，刷新页面</a-button>
        </div>
      </template>
    </div>
  </a-drawer>
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

/* ===== 底部抽屉内容 ===== */
.sheet {
  padding: 8px 22px 26px;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(140, 140, 140, 0.4);
  margin: 6px auto 16px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 10px;
}

.sheet-desc {
  font-size: 14px;
  line-height: 1.7;
  color: #bbb;
}

.sheet-desc .hl {
  color: #4d9bff;
  font-family: monospace;
}

.sheet-steps {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
}

.sheet-steps-title {
  font-size: 13px;
  color: #ddd;
  margin-bottom: 8px;
  font-weight: 600;
}

.sheet-step {
  font-size: 13px;
  color: #bbb;
  line-height: 1.9;
}

.sheet-step-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

.sheet-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.sheet-actions :deep(.ant-btn) {
  flex: 1;
}
</style>

<style>
/* 抽屉需挂到 body，用全局样式圆角 + 深色底 */
.version-sheet .ant-drawer-content {
  border-radius: 18px 18px 0 0;
  background: #171b28;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
}
.version-sheet .ant-drawer-header {
  display: none;
}
</style>
