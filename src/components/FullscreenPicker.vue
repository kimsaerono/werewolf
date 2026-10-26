<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { roleAvatar } from "@/assets/roles"
import cupidThirdIcon from "@/assets/roles/第三阵营邱比特.png"
import sheriffIcon from "@/assets/roles/警长.png"

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    options: {
      value: string
      label: string
      no?: number
      name?: string
      role?: string
      alive?: boolean
      third?: boolean
      thirdIcon?: "heart" | "bomb" | "cupid"
      lover?: boolean
      cupidThird?: boolean
      sheriff?: boolean
      judge?: boolean
      idiot?: boolean
      dreamFog?: boolean
      model?: boolean
      wildTransformed?: boolean
    }[]
    /** 单选用值（点选即确认）；多选用的值数组 */
    multi?: boolean
    min?: number
    max?: number
    initial?: string[]
    /** 被禁点击的值列表（点击时弹全屏提示） */
    blockedValues?: string[]
    /** 被禁点击时的提示文字 */
    blockedMsg?: string
    /** 按值禁选：key=value，value=禁选原因文字（如 "已出局"、"不能自刀"） */
    disabledMap?: Record<string, string>
  }>(),
  {
    multi: false,
    min: 1,
    max: 0,
    initial: () => [],
    blockedValues: () => [],
    blockedMsg: "不能选择该玩家",
    disabledMap: () => ({}),
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
/** 卡片是否被 disabledMap 禁选（已出局/不符合条件等） */
function isDisabledByMap(v: string): boolean {
  return v in props.disabledMap
}
/** 卡片不可点击的完整原因（disabledMap 优先，其次 blockedMsg） */
function disabledReason(v: string): string {
  return props.disabledMap[v] || props.blockedMsg
}
function toggle(v: string) {
  if (isBlocked(v) || isDisabledByMap(v)) {
    blockedToast.value = disabledReason(v)
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
        :class="{
          active: isActive(opt),
          disabled: disabled(opt.value) || isBlocked(opt.value) || isDisabledByMap(opt.value),
          'third-camp': opt.third,
          dead: opt.alive === false,
        }"
        :title="opt.role || ''"
        @click="toggle(opt.value)"
      >
        <img v-if="roleBg(opt.role)" class="fp-card-bg" :src="roleBg(opt.role)" :alt="opt.role" aria-hidden="true" />
        <div v-if="opt.alive === false" class="fp-out-stamp">OUT</div>
        <span v-if="opt.third" class="fp-third-circle" :title="opt.thirdIcon === 'bomb' ? '第三方·炸弹人' : '第三方·人狼恋'">
          <img v-if="opt.thirdIcon === 'cupid'" :src="cupidThirdIcon" alt="第三阵营丘比特" />
          <template v-else>{{ opt.thirdIcon === "bomb" ? "💣" : "💘" }}</template>
        </span>
        <span v-if="opt.lover && !opt.third" class="fp-lover" title="情侣">💔</span>
        <span v-if="opt.sheriff" class="fp-sheriff" title="警长"><img :src="sheriffIcon" alt="警长" /></span>
        <span v-if="opt.idiot" class="fp-idiot" title="白痴已翻牌">🙊</span>
        <span v-if="opt.wildTransformed" class="fp-wild" title="野孩子已黑化">🐺</span>
        <div v-if="opt.model || opt.dreamFog" class="fp-side-tags">
          <span v-if="opt.model" class="fp-side-tag model" title="野孩子的榜样">榜</span>
          <span v-if="opt.dreamFog" class="fp-side-tag dream" title="本夜梦游者">梦</span>
        </div>
        <template v-if="opt.no !== undefined">
          <div class="fp-no">{{ opt.no }}</div>
          <div class="fp-name">{{ opt.judge ? "⚖️ " : "" }}{{ opt.name || opt.label }}</div>
          <div v-if="isBlocked(opt.value) || (isDisabledByMap(opt.value) && opt.alive !== false)" class="fp-blocked-badge">{{ disabledReason(opt.value) }}</div>
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
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: min(480px, 100%);
  max-height: 70vh;
  overflow-y: auto;
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
  border: 1px solid #2ed57344;
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
  object-position: center;
  filter: brightness(0.55) saturate(0.9);
  pointer-events: none;
  z-index: 0;
}
@keyframes fp-flow {
  0% { box-shadow: inset 0 0 0 3px #2ed573, 0 0 14px rgba(46, 213, 115, 0.6); }
  50% { box-shadow: inset 0 0 0 3px #2ed573, 0 0 28px rgba(46, 213, 115, 1), 0 0 40px rgba(46, 213, 115, 0.8); }
  100% { box-shadow: inset 0 0 0 3px #2ed573, 0 0 14px rgba(46, 213, 115, 0.6); }
}
.fp-card.active {
  border-color: #2ed573;
  background: #2ed57314;
  box-shadow: inset 0 0 0 3px #2ed573, 0 0 14px rgba(46, 213, 115, 0.6);
  animation: fp-flow 2s ease-in-out infinite;
}
.fp-card.disabled {
  cursor: not-allowed;
}
.fp-card.disabled::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 12px;
  pointer-events: none;
  z-index: 2;
}

/* ===== 与座位牌一致的状态标识 ===== */
.fp-card.third-camp {
  outline: 2px solid #9a6fe8;
  outline-offset: -2px;
}
.fp-card.dead {
  opacity: 0.78;
}
.fp-third-circle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  z-index: 5;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #a97cf0 0%, #6f3fb5 100%);
  border: 1.5px solid #e3d2ff;
  box-shadow: 0 2px 8px rgba(80, 30, 140, 0.6), 0 0 10px rgba(154, 111, 232, 0.5);
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
}
.fp-third-circle img {
  width: 14px;
  height: 14px;
}
.fp-lover {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  font-size: 12px;
  background: #ff5a8a;
  color: #fff;
  border-radius: 4px;
  padding: 1px 3px;
  line-height: 1.2;
  pointer-events: none;
}
.fp-sheriff {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #ffd666 0%, #d49a00 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.fp-sheriff img {
  width: 14px;
  height: 14px;
}
.fp-idiot {
  position: absolute;
  bottom: 6px;
  left: 6px;
  z-index: 5;
  font-size: 12px;
  pointer-events: none;
}
.fp-wild {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  font-size: 14px;
  pointer-events: none;
}
.fp-side-tags {
  position: absolute;
  top: 50%;
  left: 6px;
  transform: translateY(-50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
}
.fp-side-tag {
  font-size: 9px;
  line-height: 1.3;
  padding: 1px 3px;
  border-radius: 3px;
  color: #fff;
  background: rgba(20, 40, 30, 0.8);
}
.fp-side-tag.model {
  background: #2ed573;
  color: #08210f;
}
.fp-side-tag.dream {
  background: #8a6dff;
}
.fp-blocked-badge {
  position: relative;
  z-index: 5;
  font-size: 13px;
  font-weight: 700;
  color: #2ed573;
  margin-top: 6px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 999px;
  border: 1px solid rgba(46, 213, 115, 0.6);
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
  box-shadow: 0 2px 12px rgba(46, 213, 115, 0.4);
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
/** 已出局玩家头像上的斜向 OUT 印章（正中间） */
.fp-out-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-25deg);
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 30%, #ff4d4f, #b80000);
  color: #fff;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 2px;
  text-transform: uppercase;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), inset 0 -2px 8px rgba(0, 0, 0, 0.4);
  z-index: 3;
  pointer-events: none;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
}
.fp-actions {
  display: flex;
  gap: 12px;
}
</style>