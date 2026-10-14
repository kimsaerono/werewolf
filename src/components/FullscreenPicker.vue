<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { roleAvatar } from "@/assets/roles"

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
/** 角色背景图：有对应头像则返回路径（用作卡片背景），否则空串 */
const roleBg = (r?: string) => (r ? roleAvatar(r) : "")
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
        :class="{ active: isActive(opt), disabled: disabled(opt.value) || isBlocked(opt.value) }"
        :title="opt.role || ''"
        @click="toggle(opt.value)"
      >
        <img v-if="roleBg(opt.role)" class="fp-card-bg" :src="roleBg(opt.role)" :alt="opt.role" aria-hidden="true" />
        <template v-if="opt.no !== undefined">
          <div class="fp-no">{{ opt.no }}</div>
          <div class="fp-name">{{ opt.name || opt.label }}</div>
          <div v-if="isBlocked(opt.value)" class="fp-blocked-badge">{{ blockedMsg }}</div>
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
  z-index: 99999;
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
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  background: #1d2233;
  border: 1px solid #2b3145;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.fp-card:hover {
  border-color: #2ed573;
  background: #232a3d;
}
/* 角色头像作卡片背景（压暗，便于识别角色又不干扰文字） */
.fp-card-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  filter: brightness(0.55) saturate(0.9);
  pointer-events: none;
  z-index: 0;
}
.fp-card.active {
  border-color: #2ed573;
  background: #2ed57314;
  box-shadow: inset 0 0 0 3px #2ed573, 0 0 14px rgba(46, 213, 115, 0.6);
}
.fp-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.fp-blocked-badge {
  position: relative;
  z-index: 1;
  font-size: 11px;
  color: #ff7875;
  margin-top: 4px;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}
.fp-no {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(10, 14, 24, 0.78);
  border: 1.5px solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}
.fp-name {
  position: relative;
  z-index: 1;
  font-size: 18px;
  color: #eee;
  margin-top: 2px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}
.fp-actions {
  display: flex;
  gap: 12px;
}
</style>