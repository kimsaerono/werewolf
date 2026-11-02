<script setup lang="ts">
import { computed, ref } from "vue"
import { SPECIALS, useTheme } from "@/composables/useTheme"
import type { ThemeId } from "@/composables/useTheme"

const props = defineProps<{ open?: boolean; hideFab?: boolean }>()
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>()

const internalOpen = ref(false)
const open = computed({
  get: () => props.open ?? internalOpen.value,
  set: (v) => {
    if (props.open !== undefined) emit("update:open", v)
    else internalOpen.value = v
  },
})

const { activeSpecial, setTheme } = useTheme()

const options = computed(() => [
  { id: "classic", name: "经典", emoji: "🐺", desc: "默认主题，无专场皮肤" },
  ...SPECIALS.map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, desc: s.desc })),
])

function currentId(): string {
  return activeSpecial.value?.id ?? "classic"
}
</script>

<template>
  <a-tooltip v-if="!hideFab" title="专场与主题设置" placement="right">
    <a-button class="fab" type="default" shape="circle" size="large" @click="open = true">🎪</a-button>
  </a-tooltip>

  <a-drawer v-model:open="open" title="🎪 专场集合" placement="right" width="380">
    <div
      v-for="o in options"
      :key="o.id"
      class="special-row"
      :class="{ active: currentId() === o.id }"
      @click="setTheme(o.id as ThemeId)"
    >
      <div class="special-emoji">{{ o.emoji }}</div>
      <div class="special-body">
        <div class="special-name">{{ o.name }}</div>
        <div class="small" style="color: #999">{{ o.desc }}</div>
      </div>
      <div class="special-check">{{ currentId() === o.id ? "●" : "○" }}</div>
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
.special-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  border: 1px solid #ffffff1a;
  background: #1b1b2b;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.special-row.active {
  border-color: #ff9a3d;
  background: #ff7a1814;
}
.special-emoji {
  font-size: 28px;
  line-height: 1;
}
.special-body {
  flex: 1;
  min-width: 0;
}
.special-name {
  color: #eee;
  font-weight: 600;
  margin-bottom: 4px;
}
.special-check {
  color: #ff9a3d;
  font-size: 14px;
}
</style>
