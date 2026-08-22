<script setup>
import { computed, ref } from 'vue'
import GameConfigForm from '@/components/game/GameConfigForm.vue'
import { splitPaths } from '@/constants/gameConfig'

/**
 * The room settings dialog, shared by the setup page and the host lobby.
 *
 * Both screens edit the same shape - the `editable` map of a mode - so they share the
 * dialog and only differ in what the footer does: the setup page keeps the values until
 * the room is created, the lobby saves them to a room that already exists.
 *
 * The everyday settings are shown first and the rest sits behind the advanced block; which
 * paths those are comes from `splitPaths`, never from a list kept in a screen.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  editable: { type: Object, default: () => ({}) },
  // Flat map keyed by dotted path, e.g. { 'flow.lives': 3 }
  modelValue: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: 'Room settings' },
  description: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'close'])

const advancedOpen = ref(false)
const split = computed(() => splitPaths(props.editable))

function update(values) {
  emit('update:modelValue', values)
}
</script>

<template>
  <!--
    Teleported: a page root carries a transform while its entrance animation runs, and a
    fixed element inside a transformed ancestor is positioned against that ancestor instead
    of the viewport.
  -->
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-md"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[85vh] w-[80vw] flex-col overflow-hidden rounded-lg bg-paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-settings-title"
        tabindex="-1"
        @keydown.esc="emit('close')"
      >
        <header class="flex items-start justify-between gap-sm border-hairline border-x-0 border-t-0 px-xl py-lg">
          <div class="min-w-0">
            <p id="room-settings-title" class="text-heading-3 text-ink">
              {{ title }}
            </p>
            <p v-if="description" class="mt-xxs text-caption text-ink-faint">
              {{ description }}
            </p>
          </div>
          <button
            class="shrink-0 rounded-md p-xxs text-ink-muted transition-colors hover:text-ink"
            type="button"
            title="Close"
            @click="emit('close')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              class="h-[18px] w-[18px]"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <span class="sr-only">Close</span>
          </button>
        </header>

        <div class="grow overflow-y-auto overscroll-contain px-xl py-lg">
          <GameConfigForm
            :editable="editable"
            :model-value="modelValue"
            :paths="split.common"
            :disabled="disabled"
            @update:model-value="update"
          />

          <div v-if="split.advanced.length" class="mt-lg rounded-md border-hairline">
            <button
              class="flex w-full items-center justify-between gap-xs px-md py-sm text-left"
              type="button"
              :aria-expanded="advancedOpen"
              @click="advancedOpen = !advancedOpen"
            >
              <span class="text-body-sm font-medium text-ink">Advanced options</span>
              <span class="text-caption text-ink-faint">
                {{ advancedOpen ? 'Hide' : `${split.advanced.length} more` }}
              </span>
            </button>
            <div v-if="advancedOpen" class="px-md pb-md">
              <GameConfigForm
                :editable="editable"
                :model-value="modelValue"
                :paths="split.advanced"
                :disabled="disabled"
                @update:model-value="update"
              />
            </div>
          </div>

          <slot name="notes" />
        </div>

        <footer class="flex flex-wrap items-center justify-end gap-xs border-hairline border-x-0 border-b-0 px-xl py-lg">
          <slot name="footer">
            <button class="btn btn-primary" type="button" @click="emit('close')">
              Done
            </button>
          </slot>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
