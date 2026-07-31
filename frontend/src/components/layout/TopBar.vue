<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const mobileOpen = ref(false)
const menuOpen = ref(false)
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
  menuOpen.value = false
  mobileOpen.value = false
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

        <!--
          The session is only known after the first /users/me probe. Until then no
          auth control is rendered at all, so the header never shows a wrong state.
        -->
        <div v-if="!auth.ready" class="h-[34px] w-[34px] shrink-0 rounded-full bg-canvas-soft"></div>

        <!-- Signed in: avatar only. The name and email live inside the dropdown. -->
        <div v-else-if="auth.isLoggedIn" class="relative">
          <button
            class="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-hairline transition-shadow duration-150 hover:ring-ink-faint"
            type="button"
            :aria-expanded="menuOpen"
            :aria-label="auth.displayName"
            :title="auth.displayName"
            aria-haspopup="menu"
            @click="menuOpen = !menuOpen"
          >
            <img
              v-if="auth.avatarUrl"
              :src="auth.avatarUrl"
              :alt="auth.displayName"
              class="h-full w-full object-cover"
            />
            <span v-else class="grid h-full w-full place-items-center bg-primary text-[13px] font-semibold text-white">
              {{ auth.initials }}
            </span>
          </button>

          <div
            v-if="menuOpen"
            class="absolute right-0 top-[calc(100%+8px)] w-[220px] rounded-lg border border-hairline bg-surface p-xxs shadow-1"
            role="menu"
          >
            <div class="px-sm py-xs">
              <p class="truncate text-body-sm font-medium text-ink">{{ auth.displayName }}</p>
              <p class="truncate text-caption text-ink-faint">{{ auth.user?.email }}</p>
            </div>
            <RouterLink
              :to="{ name: 'library' }"
              class="block rounded-md px-sm py-xs text-body-sm text-ink-secondary hover:bg-canvas-soft"
              role="menuitem"
              @click="menuOpen = false"
            >
              My library
            </RouterLink>
            <button
              class="block w-full rounded-md px-sm py-xs text-left text-body-sm text-ink-secondary hover:bg-canvas-soft"
              type="button"
              role="menuitem"
              @click="handleLogout"
            >
              Log out
            </button>
          </div>
        </div>

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
          v-if="auth.ready && !auth.isLoggedIn"
          :to="{ name: 'login' }"
          class="btn-utility"
          @click="mobileOpen = false"
        >
          Log in
        </RouterLink>
        <button v-else-if="auth.ready" class="btn-utility" type="button" @click="handleLogout">
          Log out
        </button>
      </div>
    </div>
  </header>
</template>
