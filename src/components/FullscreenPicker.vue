<script setup lang="ts">
import { computed, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    options: { value: string; label: string; no?: number; name?: string; role?: string }[]
    /** 单选用值（点选即确认）；多选用的值数组 */
    multi?: boolean
    min?: number
    max?: number
    initial?: string[]
    /** 被禁点击的值列表（点击时弹全屏提示） */
    blockedValues?: string[]
    /** 被禁点击时的提示文字 */
    blockedMsg?: string
  }>(),
  {
    multi: false,
    min: 1,
    max: 0,
    initial: () => [],
    blockedValues: () => [],
    blockedMsg: "不能选择该玩家",
  },
)
const emit = defineEmits<{
  confirmSingle: [v: string]
  confirmMulti: [v: string[]]
  cancel: []
}>()

const single = ref("")
const multiSel = ref<string[]>([])
const blockedToast = ref("")

watch(
  () => props.open,
  (o) => {
    if (o) {
      single.value = ""
      multiSel.value = [...props.initial]
    }
  },
)

/** 卡片是否禁用：多选且已选满 max 个，且当前卡未选中 */
function disabled(v: string): boolean {
  if (!props.multi) return false
  if (props.max > 0 && !multiSel.value.includes(v) && multiSel.value.length >= props.max) return true
  return false
}
/** 卡片是否被禁（守卫不能同守等） */
function isBlocked(v: string): boolean {
  return props.blockedValues.includes(v)
}
function toggle(v: string) {
  if (isBlocked(v)) {
    blockedToast.value = props.blockedMsg
    setTimeout(() => (blockedToast.value = ""), 1500)
    return
  }
  if (!props.multi) {
    // 单选：点选高亮，底部确认后执行
    single.value = v
    return
  }
  if (disabled(v)) return
  const i = multiSel.value.indexOf(v)
  if (i >= 0) multiSel.value.splice(i, 1)
  else multiSel.value.push(v)
}
function confirm() {
  if (props.multi) {
    if (multiSel.value.length < props.min) return
    emit("confirmMulti", [...multiSel.value])
    return
  }
  if (!single.value) return
  emit("confirmSingle", single.value)
}
const selected = computed(() => (props.multi ? multiSel.value : single.value))
/** 角色配色（与 GamePanel 一致，用于姓名/角色着色） */
const ROLE_COLOR: Record<string, string> = {
  狼人: "#ff4d4f",
  白狼王: "#ff4d4f",
  狼王: "#ff4d4f",
  预言家: "#40a9ff",
  女巫: "#73d13d",
  猎人: "#ffa940",
  守卫: "#36cfc9",
  骑士: "#b37feb",
  白痴: "#ffd666",
  丘比特: "#ff85c0",
  平民: "#bfbfbf",
}
const roleColor = (r?: string) => ROLE_COLOR[r || ""] || "#fff"
const ROLE_EMOJI: Record<string, string> = {
  狼人: "🐺",
  白狼王: "❄️🐺",
  狼王: "🔫🐺",
  预言家: "🔮",
  女巫: "🧙",
  猎人: "🔫",
  守卫: "🛡️",
  骑士: "⚔️",
  白痴: "🙊",
  平民: "👤",
  丘比特: "💘",
}
/** 选项是否已选中（多选用数组，单选用值） */
const isActive = (opt: { value: string }): boolean => (props.multi ? multiSel.value.includes(opt.value) : single.value === opt.value)
</script>

<template>
  <div v-if="open" class="fp-overlay">
    <div class="fp-title">
      {{ title }}
      <span v-if="multi" class="fp-count">{{ multiSel.length }}/{{ max || "任选" }}</span>
    </div>
    <div class="fp-grid">
      <div
        v-for="opt in options"
        :key="opt.value"
        class="fp-card"
        :class="{ active: isActive(opt), disabled: disabled(opt.value) }"
        @click="toggle(opt.value)"
      >
        <template v-if="opt.no !== undefined">
          <div class="fp-no">{{ opt.no }}</div>
          <div class="fp-name">{{ opt.name || opt.label }}</div>
          <div class="fp-role" :style="{ color: roleColor(opt.role) }">{{ ROLE_EMOJI[opt.role || ""] || "" }}{{ opt.role || "" }}</div>
        </template>
        <template v-else>
          {{ opt.label }}
        </template>
      </div>
    </div>
    <div class="fp-actions">
      <a-button size="large" @click="emit('cancel')">取消</a-button>
      <a-button type="primary" size="large" :disabled="multi ? multiSel.length < min : !single" @click="confirm">确认</a-button>
    </div>
  </div>
</template>

<style scoped>
.fp-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
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
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
  width: min(720px, 100%);
}
.fp-card {
  background: #1d2233;
  border: 1px solid #2b3145;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
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
.fp-no {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}
.fp-name {
  font-size: 14px;
  color: #eee;
  margin-top: 2px;
}
.fp-role {
  font-size: 12px;
  margin-top: 2px;
}
.fp-actions {
  display: flex;
  gap: 12px;
}
</style>