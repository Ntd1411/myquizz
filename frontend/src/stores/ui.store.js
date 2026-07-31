import { defineStore } from 'pinia'
import { ref } from 'vue'

let nextId = 1

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([])

  function toast(message, variant = 'info', duration = 3200) {
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
