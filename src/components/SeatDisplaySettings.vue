<script setup lang="ts">
import { ref } from "vue"
import { useSeatDisplay } from "@/composables/useSeatDisplay"

const open = ref(false)
const { alwaysOpen, setAlwaysOpen } = useSeatDisplay()
</script>

<template>
  <a-tooltip title="座位显示设置" placement="right">
    <a-button class="fab" type="default" shape="circle" size="large" @click="open = true">📌</a-button>
  </a-tooltip>

  <a-drawer v-model:open="open" title="🎛️ 座位显示" placement="right" width="360">
    <div class="seat-display-row">
      <div>
        <div class="seat-display-title">左右座位常显</div>
        <div class="small" style="color: #999">开启后两列座位一直完整显示；关闭则保持自动收起</div>
      </div>
      <a-switch :checked="alwaysOpen" @change="setAlwaysOpen(!!$event)" />
    </div>
  </a-drawer>
</template>

<style scoped>
.fab {
  width: 48px;
  height: 48px;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.seat-display-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}
.seat-display-title {
  color: #eee;
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
