<script setup lang="ts">
import { computed, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    options: { value: string; label: string }[]
    /** 单选用值（点选即确认）；多选用的值数组 */
    multi?: boolean
    min?: number
    max?: number
    initial?: string[]
  }>(),
  {
    multi: false,
    min: 1,
    max: 0,
    initial: () => [],
  },
)
const emit = defineEmits<{
  confirmSingle: [v: string]
  confirmMulti: [v: string[]]
  cancel: []
}>()

const single = ref("")
const multi = ref<string[]>([])

watch(
  () => props.open,
  (o) => {
    if (o) {
      single.value = ""
      multi.value = [...props.initial]
    }
  },
)

/** 卡片是否禁用：多选且已选满 max 个，且当前卡未选中 */
function disabled(v: string): boolean {
  if (!props.multi) return false
  if (props.max > 0 && !multi.value.includes(v) && multi.value.length >= props.max) return true
  return false
}
function toggle(v: string) {
  if (!props.multi) {
    // 单选：点选即确认
    emit("confirmSingle", v)
    return
  }
  if (disabled(v)) return
  const i = multi.value.indexOf(v)
  if (i >= 0) multi.value.splice(i, 1)
  else multi.value.push(v)
}
function confirm() {
  if (props.multi) {
    if (multi.value.length < props.min) return
    emit("confirmMulti", [...multi.value])
  }
}
const selected = computed(() => (props.multi ? multi.value : single.value))
</script>

<template>
  <div v-if="open" class="fp-overlay">
    <div class="fp-title">
      {{ title }}
      <span v-if="multi" class="fp-count">{{ multi.length }}/{{ max || "任选" }}</span>
    </div>
    <div class="fp-grid">
      <div
        v-for="opt in options"
        :key="opt.value"
        class="fp-card"
        :class="{ active: selected.includes(opt.value), disabled: disabled(opt.value) }"
        @click="toggle(opt.value)"
      >
        <span class="fp-check">{{ multi ? (selected.includes(opt.value) ? "☑" : "☐") : (selected === opt.value ? "●" : "○") }}</span>
        {{ opt.label }}
      </div>
    </div>
    <div v-if="multi" class="fp-actions">
      <a-button size="large" @click="emit('cancel')">取消</a-button>
      <a-button type="primary" size="large" :disabled="multi.length < min" @click="confirm">确认</a-button>
    </div>
  </div>
</template>

<style scoped>
.fp-overlay {
  position: fixed;
  inset: 0;
  z-index: 950;
  background: rgba(8, 11, 20, 0.97);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px;
  overflow-y: auto;
}
.fp-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  text-align: center;
}
.fp-count {
  margin-left: 8px;
  color: #2ed573;
  font-size: 16px;
}
.fp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  width: min(760px, 100%);
}
.fp-card {
  background: #1d2233;
  border: 1px solid #2b3145;
  border-radius: 12px;
  padding: 14px 10px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
}
.fp-card:hover {
  border-color: #2ed573;
  background: #232a3d;
}
.fp-card.active {
  border-color: #2ed573;
  background: #2ed57314;
}
.fp-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.fp-check {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 16px;
  color: #888;
}
.fp-card.active .fp-check {
  color: #2ed573;
}
.fp-actions {
  display: flex;
  gap: 12px;
}
</style>