export type AudioActivityListener = (active: boolean) => void

let activityCount = 0
const listeners = new Set<AudioActivityListener>()

function notifyListeners(active: boolean): void {
  for (const listener of [...listeners]) listener(active)
}

export function beginAudioActivity(): () => void {
  activityCount += 1
  if (activityCount === 1) notifyListeners(true)

  let released = false
  return () => {
    if (released) return
    released = true
    // 防御：计数已被测试重置清零时，陈旧 release 会把计数压成负数，
    // 导致后续 activityCount === 1 永不成立（活动不再通知）。
    if (activityCount > 0) activityCount -= 1
    if (activityCount === 0) notifyListeners(false)
  }
}

export function subscribeAudioActivity(listener: AudioActivityListener): () => void {
  listeners.add(listener)
  if (activityCount > 0) listener(true)
  return () => {
    listeners.delete(listener)
  }
}

/** 仅供测试：模块级单例在同进程跨测试文件残留，需显式清零 */
export function __resetAudioActivityForTest(): void {
  activityCount = 0
  listeners.clear()
}
