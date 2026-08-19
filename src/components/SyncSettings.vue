<script setup lang="ts">
import { ref } from "vue"
import { App as AntApp } from "ant-design-vue"
import { getSyncPassword, setSyncPassword, testSyncConnection } from "@/api/feishuSync"

const { message } = AntApp.useApp()

const open = ref(false)
const pw = ref(getSyncPassword())
const testing = ref(false)

function onSave() {
  setSyncPassword(pw.value.trim())
  message.success("同步口令已保存")
}

async function onTest() {
  setSyncPassword(pw.value.trim())
  testing.value = true
  try {
    const err = await testSyncConnection()
    if (err) message.error(`测试失败：${err}`)
    else message.success("✅ 同步连接正常，口令正确")
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <a-tooltip title="同步设置（口令）" placement="right">
    <a-button class="sync-fab" type="default" shape="circle" size="large" @click="open = true">🔑</a-button>
  </a-tooltip>

  <a-drawer v-model:open="open" title="🔑 同步设置" placement="right" width="400">
    <p class="small" style="color: #999">
      同步到飞书需填写口令。口令仅保存在本机浏览器（localStorage），不会写入公开代码。
    </p>
    <a-input
      v-model:value="pw"
      placeholder="输入同步口令"
      type="password"
      allow-clear
      style="margin: 12px 0"
      @press-enter="onSave"
      @blur="onSave"
    />
    <a-space>
      <a-button type="primary" :loading="testing" @click="onTest">测试连接</a-button>
    </a-space>
  </a-drawer>
</template>

<style scoped>
.sync-fab {
  position: fixed;
  left: 16px;
  bottom: 148px;
  z-index: 500;
  width: 48px;
  height: 48px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
</style>