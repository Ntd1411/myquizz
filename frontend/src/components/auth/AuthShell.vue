<script setup>
import { RouterLink } from 'vue-router'
import BrandLogo from '@/components/base/BrandLogo.vue'

/**
 * Split-screen shell for the auth pages: brand top-left, the form centred in the
 * left column, and cover art filling the right column on desktop. Transcribed
 * from the reference split layout onto the v2.1 tokens - no dark surface exists
 * in this system, so the cover stays full colour and the page stays paper.
 */
defineProps({
  coverSrc: { type: String, default: '/auth-cover.svg' },
  coverAlt: { type: String, default: '' },
})
</script>

<template>
  <div class="grid min-h-svh lg:grid-cols-2">
    <div class="flex flex-col gap-md p-lg md:p-[40px]">
      <div class="flex justify-center md:justify-start">
        <RouterLink :to="{ name: 'home' }" aria-label="Back to MyQuizz home">
          <BrandLogo :size="30" />
        </RouterLink>
      </div>

      <div class="flex flex-1 items-center justify-center py-lg">
        <div class="w-full max-w-[320px]">
          <slot />
        </div>
      </div>
    </div>

    <div class="relative hidden bg-wash lg:block">
      <img :src="coverSrc" :alt="coverAlt" class="absolute inset-0 h-full w-full object-cover" >
    </div>
  </div>
</template>
