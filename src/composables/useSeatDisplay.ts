import { ref, watch } from "vue"

const STORAGE_KEY = "werewolf_seat_always_open"

let initial = false
try {
  initial = localStorage.getItem(STORAGE_KEY) === "1"
} catch {
  /* ignore */
}

const alwaysOpen = ref(initial)

watch(alwaysOpen, (v) => {
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0")
  } catch {
    /* ignore */
  }
})

export function useSeatDisplay() {
  return {
    alwaysOpen,
    setAlwaysOpen(v: boolean) {
      alwaysOpen.value = v
    },
  }
}
