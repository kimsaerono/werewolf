<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import Sortable from "sortablejs"
import { ROLE_EMOJI } from "@/game/logic"
import type { Player } from "@/game/logic"
import { roleAvatar } from "@/assets/roles"

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

// ===== 拖动排序：单一 Sortable 容器 + CSS 分列（跨列稳定） =====
const listEl = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null

function makeSortable(): Sortable {
  return new Sortable(listEl.value as HTMLElement, {
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    delay: 200,
    delayOnTouchOnly: true,
    touchStartThreshold: 3,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
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
      // 读容器 DOM 最终顺序 → 派生全局新顺序 → 交给父组件整序
      const names: string[] = []
      listEl.value
        ?.querySelectorAll<HTMLElement>(".seat-card[data-name]")
        .forEach((card) => {
          const name = card.dataset.name
          if (name) names.push(name)
        })
      if (names.length === props.players.length) emit("reorder", names)
    },
  })
}

function destroySortable() {
  sortable?.destroy()
  sortable = null
}

watch(
  () => props.draggable,
  (on) => {
    if (on) {
      destroySortable()
      if (listEl.value) sortable = makeSortable()
    } else {
      destroySortable()
    }
  },
  { immediate: true },
)

// draggable 为 true 时等待 DOM 就绪后再挂载 Sortable
onMounted(() => {
  if (props.draggable && listEl.value) sortable = makeSortable()
})
onBeforeUnmount(() => {
  destroySortable()
})

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
</script>

<template>
  <div class="seat-board" :class="{ floating }">
    <div ref="listEl" class="seat-list" :style="{ '--seat-rows': seatRows }">
      <div
        v-for="(p, idx) in players"
        :key="p.name"
        class="seat-card"
        :data-name="p.name"
        :class="{ dead: !p.alive }"
        :style="floating ? { gridColumn: idx < seatRows ? 1 : 3, gridRow: idx < seatRows ? idx + 1 : idx - seatRows + 1 } : undefined"
      >
        <span v-if="floating && draggable" class="seat-grip">⠿</span>
        <template v-if="floating">
          <span class="seat-name float">{{ p.name }}</span>
          <img v-if="p.role && roleAvatar(p.role)" class="seat-avatar float" :src="roleAvatar(p.role)" :alt="p.role" />
          <span v-else class="seat-avatar float seat-avatar-emoji">{{ p.role ? ROLE_EMOJI[p.role] || "🎭" : "🙋" }}</span>
          <span class="seat-no float">{{ p.no || idx + 1 }}</span>
          <span
            v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name))"
            class="seat-lover"
            :class="badgeClass(p)"
          >{{ badgeText(p) }}</span>
          <span v-if="p.name === jingHui" class="seat-sheriff">👑</span>
          <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
        </template>
        <template v-else>
          <span v-if="draggable" class="seat-grip">⠿</span>
          <img v-if="p.role && roleAvatar(p.role)" class="seat-avatar" :src="roleAvatar(p.role)" :alt="p.role" />
          <span v-else class="seat-avatar seat-avatar-emoji">{{ p.role ? ROLE_EMOJI[p.role] || "🎭" : "🙋" }}</span>
          <div class="seat-info">
            <div class="seat-name">
              <span v-if="p.name === judge" style="color: #ffd666">⚖️</span>
              <span v-if="p.name === jingHui" style="color: #ffd666">👑</span>
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
            v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name))"
            class="seat-lover"
            :class="badgeClass(p)"
          >{{ badgeText(p) }}</span>
          <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seat-board {
  width: 100%;
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
  pointer-events: auto;
  display: grid;
  grid-template-columns: var(--seat-col-w, 76px) 1fr var(--seat-col-w, 76px);
  grid-template-rows: repeat(var(--seat-rows), auto);
  gap: 8px;
  padding: 0 4px;
}
.seat-board.floating .seat-card {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  gap: 2px;
  border-radius: 10px;
  background: rgba(23, 27, 40, 0.88);
  backdrop-filter: blur(6px);
  cursor: grab;
}
.seat-board.floating .seat-card:active {
  cursor: grabbing;
}

/* ===== 卡片通用 ===== */
.seat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #2b3145;
  background: #1d2233;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.seat-card.dead {
  opacity: 0.5;
  background: #161a26;
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
  color: #eee;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seat-role {
  font-size: 12px;
  color: #999;
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
  background: #3742fa;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
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
}
.seat-idiot {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 11px;
}
</style>
