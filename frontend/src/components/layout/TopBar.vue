<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const mobileOpen = ref(false)
const keyword = ref('')

// Labels are English only, matching the home_myquizz.html demo navigation.
const navLinks = [
  { label: 'Discover', to: { name: 'discover' } },
  { label: 'My library', to: { name: 'library' } },
]

function submitSearch() {
  router.push({ name: 'discover', query: keyword.value ? { keyword: keyword.value } : {} })
  mobileOpen.value = false
}

async function handleLogout() {
  await auth.logout()
  ui.toast('Signed out.')
  router.push({ name: 'home' })
}
</script>

<template>
  <!-- Translucent sticky bar with the demo's saturated backdrop blur. -->
  <header class="sticky top-0 z-50 border-b border-hairline bg-white/[0.86] backdrop-blur-[10px] backdrop-saturate-[180%]">
    <div class="container-page flex h-16 items-center gap-md">
      <RouterLink :to="{ name: 'home' }" class="flex shrink-0 items-center gap-[9px]">
        <span class="h-[18px] w-[18px] rounded-[6px] bg-primary"></span>
        <span class="text-[18px] font-bold tracking-[-0.4px] text-ink">MyQuizz</span>
      </RouterLink>

      <nav class="hidden items-center gap-xxs md:flex">
        <RouterLink
          v-for="link in navLinks"
          :key="link.label"
          :to="link.to"
          class="rounded-md px-sm py-[7px] text-body-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
          active-class="font-semibold text-ink"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-[10px]">
        <form class="hidden w-[220px] lg:block" @submit.prevent="submitSearch">
          <label class="field flex items-center gap-xs">
            <svg class="h-[15px] w-[15px] shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              v-model="keyword"
              class="w-full border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-faint"
              type="search"
              placeholder="Search quizzes…"
            />
          </label>
        </form>

        <RouterLink :to="{ name: 'discover' }" class="btn-primary hidden sm:inline-flex">Join game</RouterLink>

        <button v-if="auth.isLoggedIn" class="btn-utility" type="button" @click="handleLogout">Log out</button>
        <RouterLink v-else :to="{ name: 'login' }" class="btn-utility hidden sm:inline-flex">Log in</RouterLink>

        <button
          class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-md border border-hairline bg-surface text-ink md:hidden"
          type="button"
          aria-label="Menu"
          @click="mobileOpen = !mobileOpen"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="mobileOpen" class="border-t border-hairline bg-surface md:hidden">
      <div class="container-page flex flex-col gap-xs py-sm">
        <form @submit.prevent="submitSearch">
          <input v-model="keyword" class="field" type="search" placeholder="Search quizzes…" />
        </form>
        <RouterLink
          v-for="link in navLinks"
          :key="link.label"
          :to="link.to"
          class="rounded-md px-sm py-xs text-body-md text-ink-secondary"
          @click="mobileOpen = false"
        >
          {{ link.label }}
        </RouterLink>
        <RouterLink
          v-if="!auth.isLoggedIn"
          :to="{ name: 'login' }"
          class="btn-utility"
          @click="mobileOpen = false"
        >
          Log in
        </RouterLink>
      </div>
    </div>
  </header>
</template>
