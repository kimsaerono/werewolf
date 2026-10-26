<script setup lang="ts">
import { computed } from "vue"
import type { MusicPlayer } from "@/composables/useMusicPlayer"

const props = defineProps<{
  open: boolean
  player: MusicPlayer
}>()

const emit = defineEmits<{
  close: []
}>()

const currentTrack = computed(() => props.player.currentTrack.value)
const isPlaying = computed(() => props.player.isPlaying.value)
const volume = computed(() => props.player.volume.value)
const loop = computed(() => props.player.loop.value)
const autoNight = computed(() => props.player.autoNight.value)
const error = computed(() => props.player.error.value)

function selectTrack(id: string): void {
  props.player.selectTrack(id)
}

function onVolumeChange(value: number | [number, number]): void {
  props.player.setVolume(Array.isArray(value) ? value[0] : value)
}

function formatVolume(value: number): string {
  return `${Math.round(value * 100)}%`
}
</script>

<template>
  <a-drawer
    :open="open"
    placement="right"
    :width="430"
    :mask-closable="true"
    @close="emit('close')"
  >
    <template #title>
      <div class="music-drawer-title">
        <span class="music-drawer-mark">♫</span>
        <span>夜晚背景音乐</span>
      </div>
    </template>

    <div class="music-player">
      <div class="record-stage" :class="{ 'is-playing': isPlaying }">
        <div class="record-glow"></div>
        <div class="record-disc">
          <div class="record-label">
            <span>W</span>
            <small>WEREWOLF</small>
          </div>
        </div>
        <div class="record-arm"></div>
        <div class="record-status">
          <span class="status-dot" :class="{ active: isPlaying }"></span>
          {{ isPlaying ? "正在播放" : "已暂停" }}
        </div>
      </div>

      <div class="track-heading">
        <div>
          <div class="track-label">当前曲目</div>
          <div class="track-title">{{ currentTrack?.title || "暂无歌曲" }}</div>
        </div>
        <a-tag color="cyan">NIGHT MUSIC</a-tag>
      </div>

      <a-alert v-if="error" type="warning" show-icon :message="error" class="music-error" />

      <div class="player-controls">
        <a-button
          type="text"
          class="control-button"
          aria-label="上一首"
          :disabled="player.tracks.length < 2"
          @click="player.previous"
        >
          ‹
        </a-button>
        <a-button
          type="primary"
          shape="circle"
          class="play-button"
          :aria-label="isPlaying ? '暂停' : '播放'"
          @click="player.toggle"
        >
          {{ isPlaying ? "Ⅱ" : "▶" }}
        </a-button>
        <a-button
          type="text"
          class="control-button"
          aria-label="下一首"
          :disabled="player.tracks.length < 2"
          @click="player.next"
        >
          ›
        </a-button>
      </div>

      <div class="volume-row">
        <span class="setting-label">音量</span>
        <a-slider
          class="volume-slider"
          :min="0"
          :max="1"
          :step="0.01"
          aria-label="音量"
          :value="volume"
          :tooltip-open="false"
          @change="onVolumeChange"
        />
        <span class="setting-value">{{ formatVolume(volume) }}</span>
      </div>

      <div class="player-options">
        <div class="option-row">
          <div>
            <div class="setting-label">循环播放</div>
            <div class="setting-help">夜晚背景音乐持续播放</div>
          </div>
          <a-switch aria-label="循环播放" :checked="loop" @change="player.setLoop(!!$event)" />
        </div>
        <div class="option-row">
          <div>
            <div class="setting-label">夜晚自动播放</div>
            <div class="setting-help">入夜自动播放，天亮自动停止；随时可手动控制</div>
          </div>
          <a-switch aria-label="夜晚自动播放" :checked="autoNight" @change="player.setAutoNight(!!$event)" />
        </div>
      </div>

      <a-divider />

      <div class="playlist-heading">
        <span>播放列表</span>
        <span class="playlist-count">{{ player.tracks.length }} 首</span>
      </div>
      <div class="track-list">
        <button
          v-for="track in player.tracks"
          :key="track.id"
          type="button"
          class="track-item"
          :class="{ active: currentTrack?.id === track.id }"
          @click="selectTrack(track.id)"
        >
          <span class="track-index">{{ player.tracks.indexOf(track) + 1 }}</span>
          <span class="track-item-title">{{ track.title }}</span>
          <span v-if="currentTrack?.id === track.id" class="track-playing">{{ isPlaying ? "播放中" : "已选择" }}</span>
        </button>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
.music-drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #f2f6ff;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.music-drawer-mark {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid rgba(102, 224, 255, 0.55);
  border-radius: 9px;
  color: #66e0ff;
  background: rgba(102, 224, 255, 0.1);
  font-size: 17px;
}
.music-player {
  color: #e7ecf7;
}
.record-stage {
  position: relative;
  display: flex;
  min-height: 270px;
  align-items: center;
  justify-content: center;
  margin: 4px 0 22px;
  overflow: hidden;
  border: 1px solid rgba(126, 160, 211, 0.2);
  border-radius: 22px;
  background: radial-gradient(circle at 50% 48%, rgba(47, 77, 123, 0.34), transparent 42%), #101725;
  box-shadow: inset 0 0 44px rgba(54, 105, 161, 0.12), 0 18px 40px rgba(0, 0, 0, 0.24);
}
.record-stage::before,
.record-stage::after {
  position: absolute;
  width: 220px;
  height: 220px;
  border: 1px solid rgba(126, 160, 211, 0.1);
  border-radius: 50%;
  content: "";
}
.record-stage::after {
  width: 180px;
  height: 180px;
  border-color: rgba(126, 160, 211, 0.08);
}
.record-glow {
  position: absolute;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: rgba(53, 169, 255, 0.12);
  filter: blur(28px);
}
.record-disc {
  position: relative;
  z-index: 2;
  width: 174px;
  height: 174px;
  border: 9px solid #1a222f;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #273241 0 2px, #1b2532 3px 5px, #303b4c 6px 7px);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: record-spin 9s linear infinite;
  animation-play-state: paused;
}
.is-playing .record-disc {
  animation-play-state: running;
}
.record-label {
  position: absolute;
  inset: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(105, 218, 255, 0.35);
  border-radius: 50%;
  color: #66e0ff;
  background: #182b3b;
  box-shadow: 0 0 0 5px rgba(8, 13, 21, 0.42);
  font-weight: 800;
  letter-spacing: 0.12em;
}
.record-label small {
  margin-top: 3px;
  color: #a8bed2;
  font-size: 7px;
  letter-spacing: 0.18em;
}
.record-arm {
  position: absolute;
  z-index: 3;
  top: 30px;
  right: 58px;
  width: 78px;
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #6e7f96, #d5e5f5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  transform: rotate(32deg);
  transform-origin: right center;
}
.record-status {
  position: absolute;
  right: 16px;
  bottom: 14px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #91a4bc;
  font-size: 12px;
  letter-spacing: 0.08em;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #68768b;
}
.status-dot.active {
  background: #66e0ff;
  box-shadow: 0 0 12px #66e0ff;
}
.track-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.track-label,
.setting-label {
  color: #8496ad;
  font-size: 12px;
  letter-spacing: 0.08em;
}
.track-title {
  margin-top: 5px;
  color: #f5f8ff;
  font-size: 20px;
  font-weight: 700;
}
.music-error {
  margin-bottom: 14px;
}
.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  margin: 20px 0 22px;
}
.play-button {
  width: 58px;
  height: 58px;
  border: 0;
  color: #07111d;
  background: #66e0ff;
  box-shadow: 0 8px 22px rgba(102, 224, 255, 0.22);
  font-size: 20px;
}
.play-button:hover,
.play-button:focus {
  color: #07111d !important;
  background: #a0efff !important;
}
.control-button {
  width: 38px;
  height: 38px;
  color: #9eb0c5;
  font-size: 30px;
  line-height: 1;
}
.control-button:hover,
.control-button:focus {
  color: #66e0ff !important;
  background: rgba(102, 224, 255, 0.1) !important;
}
.volume-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}
.volume-slider {
  flex: 1;
  margin: 0;
}
.setting-value {
  min-width: 38px;
  color: #c7d4e5;
  font-size: 12px;
  text-align: right;
}
.player-options {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid rgba(126, 160, 211, 0.16);
  border-radius: 13px;
  background: rgba(126, 160, 211, 0.12);
}
.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 13px;
  background: rgba(18, 27, 42, 0.92);
}
.setting-help {
  margin-top: 4px;
  color: #667a93;
  font-size: 11px;
}
.playlist-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #dfe8f5;
  font-weight: 600;
}
.playlist-count {
  color: #71839a;
  font-size: 12px;
  font-weight: 400;
}
.track-list {
  display: grid;
  gap: 7px;
}
.track-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: #aebed0;
  background: rgba(22, 31, 46, 0.75);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}
.track-item:hover,
.track-item:focus-visible {
  border-color: rgba(102, 224, 255, 0.4);
  background: rgba(38, 59, 78, 0.8);
  outline: none;
  transform: translateX(2px);
}
.track-item.active {
  border-color: rgba(102, 224, 255, 0.42);
  color: #e9faff;
  background: rgba(40, 83, 103, 0.42);
}
.track-index {
  display: inline-grid;
  width: 23px;
  height: 23px;
  flex: none;
  place-items: center;
  border-radius: 7px;
  color: #71859e;
  background: rgba(126, 160, 211, 0.1);
  font-size: 11px;
}
.track-item-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-playing {
  color: #66e0ff;
  font-size: 11px;
}
@keyframes record-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@media (max-width: 520px) {
  .record-stage {
    min-height: 235px;
  }
  .record-disc {
    width: 148px;
    height: 148px;
  }
  .record-label {
    inset: 39px;
  }
}
</style>
