<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import Sortable from "sortablejs"
import { ROLE_EMOJI } from "@/game/logic"
import type { Player } from "@/game/logic"
import { roleAvatar } from "@/assets/roles"
import cupidThirdIcon from "@/assets/roles/第三阵营邱比特.png"
import sheriffIcon from "@/assets/roles/警长.png"

const props = withDefaults(
  defineProps<{
    players: Player[]
    showAlive?: boolean
    showRole?: boolean
    draggable?: boolean
    showLover?: boolean
    floating?: boolean
    lovers?: string[]
    thirdMembers?: string[]
    judge?: string
    jingHui?: string
  }>(),
  {
    showAlive: true,
    showRole: true,
    draggable: false,
    showLover: false,
    floating: false,
    lovers: () => [],
    thirdMembers: () => [],
    judge: "",
    jingHui: "",
  },
)
const emit = defineEmits<{ reorder: [names: string[]] }>()

/** 悬浮列优先填充所需行数：ceil(玩家数 / 2) */
const seatRows = computed(() => Math.max(1, Math.ceil(props.players.length / 2)))
/** 左右两列各自持有的玩家（DOM 顺序 = 左列上到下，再右列上到下） */
const leftPlayers = computed(() => props.players.slice(0, seatRows.value))
const rightPlayers = computed(() => props.players.slice(seatRows.value))

// ===== 拖动排序：左右两列各自一个 Sortable + 共享 group（跨列互换、元素随手） =====
const listEl = ref<HTMLElement | null>(null)
const leftEl = ref<HTMLElement | null>(null)
const rightEl = ref<HTMLElement | null>(null)
let sortables: Sortable[] = []

/** 读整板 DOM 最终顺序（左列先、右列后）→ 派生全局新顺序 */
function collectOrder(): string[] {
  const names: string[] = []
  listEl.value
    ?.querySelectorAll<HTMLElement>(".seat-card[data-name]")
    .forEach((card) => {
      const name = card.dataset.name
      if (name) names.push(name)
    })
  return names
}

function makeSortable(el: HTMLElement): Sortable {
  return new Sortable(el, {
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    delay: 200,
    delayOnTouchOnly: true,
    touchStartThreshold: 3,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    group: { name: "seats", pull: true, put: true },
    onChoose: (evt) => {
      // 触屏长按确认后：震动反馈 + 放大提示
      const pt = (evt as unknown as { pointerType?: string }).pointerType
      if (pt === "touch" || pt === "pen") {
        vibrate(18)
      }
      if (evt.item) {
        evt.item.classList.add("dragging-lift")
      }
    },
    onEnd: (evt) => {
      if (evt.item) evt.item.classList.remove("dragging-lift")
      const names = collectOrder()
      if (names.length === props.players.length) emit("reorder", names)
    },
  })
}

function destroySortables() {
  sortables.forEach((s) => s.destroy())
  sortables = []
}

function mountSortables() {
  destroySortables()
  if (!props.draggable) return
  if (props.floating) {
    if (leftEl.value) sortables.push(makeSortable(leftEl.value))
    if (rightEl.value) sortables.push(makeSortable(rightEl.value))
  } else if (listEl.value) {
    sortables.push(makeSortable(listEl.value))
  }
}

watch(
  () => props.draggable,
  () => mountSortables(),
  { immediate: true },
)

// draggable 为 true 时等待 DOM 就绪后再挂载 Sortable
onMounted(mountSortables)
onBeforeUnmount(destroySortables)

function badgeText(p: Player): string {
  if (p.role === "丘比特") return "👑❤️"
  if (props.thirdMembers.includes(p.name)) return "❤️"
  return "💔"
}
function badgeClass(p: Player): string {
  return props.thirdMembers.includes(p.name) ? "third" : ""
}

/** 震动反馈：移动端支持 navigator.vibrate，桌面端忽略 */
function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(ms)
    } catch {
      /* ignore */
    }
  }
}

/** 角色 → 座位卡片背景色 */
const ROLE_BG: Record<string, string> = {
  白痴: "#fff",
  白狼王: "#F7F7F7",
  狼人: "rgb(125,4,13)",
  狼王: "#222228",
  猎人: "#B97846",
  女巫: "rgb(120,64,116)",
  平民: "#FFC860",
  骑士: "#B2DD98",
  守卫: "#94B8E0",
  预言家: "linear-gradient(135deg, #4088E8, #B868E0)",
  丘比特: "#F7B8D8",
}

/** 深色背景的文字需要改成浅色 */
const DARK_BG = new Set(["狼人", "狼王"])

function cardBg(p: Player): Record<string, string> | undefined {
  if (!p.alive || !p.role) return undefined
  const style: Record<string, string> = {}
  const img = roleAvatar(p.role)
  if (img) {
    style.backgroundImage = `url(${img})`
    style.backgroundSize = "cover"
    style.backgroundPosition = "center"
    style.backgroundRepeat = "no-repeat"
  }
  if (ROLE_BG[p.role]) {
    style.background = ROLE_BG[p.role]
    if (img) style.backgroundImage = `url(${img})`
  }
  if (DARK_BG.has(p.role)) {
    style.color = "#f0f0f0"
    style.borderColor = "rgba(255,255,255,0.15)"
  }
  return style
}
</script>

<template>
  <div class="seat-board" :class="{ floating }">
    <div ref="listEl" class="seat-list">
      <template v-if="floating">
        <div ref="leftEl" class="seat-col">
          <div
            v-for="(p, idx) in leftPlayers"
            :key="p.name"
            class="seat-card"
            :data-name="p.name"
            :class="{ dead: !p.alive }"
            :style="cardBg(p)"
          >
            <span v-if="draggable" class="seat-grip">⠿</span>
            <span class="seat-name float"><span v-if="p.name === judge" style="color: #ffd666">⚖️</span>{{ p.name }}</span>
            <span v-if="!p.role || !roleAvatar(p.role)" class="seat-avatar float seat-avatar-emoji">{{ p.role ? ROLE_EMOJI[p.role] || "🎭" : "🙋" }}</span>
            <span v-if="!p.alive" class="seat-dead-x">✕</span>
            <span class="seat-no float">{{ p.no || idx + 1 }}</span>
            <span
              v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name)) && !(thirdMembers.includes(p.name) && p.role === '丘比特')"
              class="seat-lover"
              :class="badgeClass(p)"
            >{{ badgeText(p) }}</span>
            <span v-if="thirdMembers.includes(p.name) && p.role === '丘比特'" class="seat-cupid-third"><img :src="cupidThirdIcon" alt="第三阵营邱比特" /></span>
            <span v-if="p.name === jingHui" class="seat-sheriff"><img :src="sheriffIcon" alt="警长" /></span>
            <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
          </div>
        </div>
        <div class="seat-col-spacer"></div>
        <div ref="rightEl" class="seat-col">
          <div
            v-for="(p, idx) in rightPlayers"
            :key="p.name"
            class="seat-card"
            :data-name="p.name"
            :class="{ dead: !p.alive }"
            :style="cardBg(p)"
          >
            <span v-if="draggable" class="seat-grip">⠿</span>
            <span class="seat-name float"><span v-if="p.name === judge" style="color: #ffd666">⚖️</span>{{ p.name }}</span>
            <span v-if="!p.role || !roleAvatar(p.role)" class="seat-avatar float seat-avatar-emoji">{{ p.role ? ROLE_EMOJI[p.role] || "🎭" : "🙋" }}</span>
            <span v-if="!p.alive" class="seat-dead-x">✕</span>
            <span class="seat-no float">{{ p.no || seatRows + idx + 1 }}</span>
            <span
              v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name)) && !(thirdMembers.includes(p.name) && p.role === '丘比特')"
              class="seat-lover"
              :class="badgeClass(p)"
            >{{ badgeText(p) }}</span>
            <span v-if="thirdMembers.includes(p.name) && p.role === '丘比特'" class="seat-cupid-third"><img :src="cupidThirdIcon" alt="第三阵营邱比特" /></span>
            <span v-if="p.name === jingHui" class="seat-sheriff"><img :src="sheriffIcon" alt="警长" /></span>
            <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
          </div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="(p, idx) in players"
          :key="p.name"
          class="seat-card"
          :data-name="p.name"
          :class="{ dead: !p.alive }"
          :style="cardBg(p)"
        >
          <span v-if="draggable" class="seat-grip">⠿</span>
          <img v-if="p.role && roleAvatar(p.role)" class="seat-avatar" :src="roleAvatar(p.role)" :alt="p.role" draggable="false" />
          <span v-else class="seat-avatar seat-avatar-emoji">{{ p.role ? ROLE_EMOJI[p.role] || "🎭" : "🙋" }}</span>
          <span v-if="!p.alive" class="seat-dead-x">✕</span>
          <div class="seat-info">
            <div class="seat-name">
              <span v-if="p.name === judge" style="color: #ffd666">⚖️</span>
              <img v-if="p.name === jingHui" :src="sheriffIcon" alt="警长" class="seat-sheriff-inline" />
              {{ p.name }}
            </div>
            <div class="seat-role">
              <template v-if="showRole && p.role">{{ ROLE_EMOJI[p.role] || "" }}{{ p.role }}</template>
              <template v-else>—</template>
            </div>
          </div>
          <div class="seat-right">
            <span v-if="showAlive" class="seat-alive" :class="{ dead: !p.alive }">{{ p.alive ? "✅" : "❌" }}</span>
            <span class="seat-no">{{ p.no || idx + 1 }}</span>
          </div>
            <span
              v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name)) && !(thirdMembers.includes(p.name) && p.role === '丘比特')"
              class="seat-lover"
              :class="badgeClass(p)"
            >{{ badgeText(p) }}</span>
          <span v-if="thirdMembers.includes(p.name) && p.role === '丘比特'" class="seat-cupid-third"><img :src="cupidThirdIcon" alt="第三阵营邱比特" /></span>
          <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.seat-board {
  width: 100%;
}
/* 禁止长按头像触发图片原生拖拽/复制/共享（移动端菜单） */
.seat-avatar {
  pointer-events: none;
  -webkit-user-drag: none;
  user-drag: none;
}
/* 出局头像上的红叉 */
.seat-dead-x {
  position: absolute;
  inset: 0; /* 整卡覆盖 */
  z-index: 3;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff4d4f;
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  background: rgba(18, 22, 34, 0.55);
  border-radius: inherit;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.9), 0 0 3px rgba(0, 0, 0, 0.9);
}
.seat-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ===== 悬浮模式：固定贴边 + 左右两列（grid 三列：左窄列 / 中间留白 / 右窄列） ===== */
.seat-board.floating {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 90;
}
.seat-board.floating .seat-list {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  pointer-events: none; /* 容器不拦截点击，只在卡片上开放 */
  display: grid;
  grid-template-columns: var(--seat-col-w, 76px) 1fr var(--seat-col-w, 76px);
  align-items: start;
  gap: 8px;
  padding: 0 4px;
}
.seat-board.floating .seat-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.seat-board.floating .seat-card {
  pointer-events: auto; /* 卡片区域可交互（拖动/滚动） */
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 4px;
  gap: 2px;
  border-radius: 10px;
  background: #ffffff;
  background-size: cover;
  background-position: center;
  border-color: #d5d9e4;
  cursor: grab;
  overflow: hidden;
  min-height: 72px;
}
.seat-board.floating .seat-card:active {
  cursor: grabbing;
}
.seat-board.floating .seat-card.dead {
  background: #161a26;
  border-color: #2b3145;
}

/* ===== 卡片通用（存活白底，可拖动） ===== */
.seat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #d5d9e4;
  background: #ffffff;
  color: #1d2233;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.seat-card.dead {
  opacity: 0.6;
  background: #161a26; /* 出局：原深色底 */
  border-color: #2b3145;
}
.seat-card.dead .seat-name {
  color: #aaa;
}
.seat-card.dead .seat-role {
  color: #888;
}
.sortable-ghost {
  opacity: 0.4;
  border-style: dashed;
  border-color: #2ed573;
  background: #2ed57314;
}
.sortable-chosen {
  background: #232a3d;
}
.sortable-drag {
  opacity: 0.95;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  border-color: #2ed573;
  z-index: 9999 !important;
}
/* 长按选中：体积稍稍放大 */
.dragging-lift {
  transform: scale(1.12);
  transition: transform 0.12s ease;
}
.seat-board.floating .seat-card.dragging-lift {
  transform: scale(1.15);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.5);
}

/* ===== 悬浮专属尺寸 ===== */
.seat-board.floating .seat-grip {
  display: none;
}
.seat-name.float {
  position: absolute;
  top: 3px;
  left: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #1d2233;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
  z-index: 1;
}
.seat-avatar.float {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  margin-top: 8px;
}
.seat-avatar-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: #2a2e40;
}
.seat-avatar-emoji.float {
  font-size: 18px;
}
.seat-no.float {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 18px;
  height: 18px;
  font-size: 10px;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
  z-index: 1;
}
.seat-avatar {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 10px;
  object-fit: cover;
}
.seat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.seat-name {
  font-weight: 600;
  font-size: 14px;
  color: #1d2233;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seat-role {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seat-right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.seat-alive {
  font-size: 15px;
}
.seat-alive.dead {
  opacity: 0.6;
}
.seat-no {
  width: 22px;
  height: 22px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2ed573; /* 存活：绿底 */
  color: #fff;
  font-weight: 700;
  font-size: 12px;
}
.seat-card.dead .seat-no {
  background: #ff4d4f; /* 出局：红底 */
}
.seat-lover {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 11px;
  background: #ff5a8a;
  color: #fff;
  border-radius: 4px;
  padding: 1px 3px;
  line-height: 1.2;
}
.seat-lover.third {
  background: #9a6fe8;
}
.seat-sheriff {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 12px;
  background: linear-gradient(180deg, #ffd666 0%, #d49a00 100%);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.seat-sheriff img,
.seat-sheriff-inline {
  width: 14px;
  height: 14px;
  vertical-align: middle;
}
.seat-cupid-third {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 11px;
}
.seat-cupid-third img {
  width: 16px;
  height: 16px;
}
.seat-idiot {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 11px;
}
</style>
