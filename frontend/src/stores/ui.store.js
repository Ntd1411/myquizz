import { defineStore } from 'pinia'
import { ref } from 'vue'

let nextId = 1

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([])

  function toast(message, variant = 'info', duration = 3200) {
    // Parallel requests can fail with the same status at the same moment. A burst of
    // 429s has to read as one warning, not as five stacked copies of the same line.
    const existing = toasts.value.find((item) => item.message === message)
    if (existing) return existing.id

    const id = nextId++
    toasts.value.push({ id, message, variant })
    window.setTimeout(() => dismiss(id), duration)
    return id
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  return { toasts, toast, dismiss }
})
