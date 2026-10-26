<script setup lang="ts">
import { ref } from "vue"
import { useTheme } from "@/composables/useTheme"

const open = ref(false)
const { isHalloween, setTheme } = useTheme()
</script>

<template>
  <a-tooltip title="主题设置" placement="right">
    <a-button class="fab" type="default" shape="circle" size="large" @click="open = true">🎃</a-button>
  </a-tooltip>

  <a-drawer v-model:open="open" title="🎃 主题设置" placement="right" width="380">
    <div class="theme-row">
      <div>
        <div class="theme-title">万圣节专场</div>
        <div class="small" style="color: #999">
          南瓜、骷髅、暗夜配色；灵媒巫师 / 暗夜巫婆 / 亡灵猎手 / 古堡守灵人分别对应预言家 / 女巫 / 猎人 / 守卫
        </div>
      </div>
      <a-switch :checked="isHalloween" @change="setTheme($event ? 'halloween' : 'classic')" />
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
.theme-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}
.theme-title {
  color: #eee;
  font-weight: 600;
  margin-bottom: 6px;
}
</style>
