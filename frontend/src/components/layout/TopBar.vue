<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

import BrandLogo from '@/components/base/BrandLogo.vue'

const auth = useAuthStore()

const route = useRoute()
const router = useRouter()

const mobileOpen = ref(false)
const menuOpen = ref(false)
const searchOpen = ref(false)
const menuRoot = ref(null)
const inlineSearchEl = ref(null)

function queryKeyword(value) {
  return typeof value === 'string' ? value : ''
}

/**
 * This is the only keyword input in the product: Discover has no search box of its own
 * and reads the keyword out of the URL instead. Mirroring the URL back into the field
 * keeps the two from ever disagreeing, so clearing the filters on Discover empties this
 * box too, and the box is blank on every page that is not a search.
 */
const keyword = ref(route.name === 'discover' ? queryKeyword(route.query.keyword) : '')

watch(
  () => (route.name === 'discover' ? queryKeyword(route.query.keyword) : ''),
  (value) => {
    keyword.value = value
  },
)

async function toggleInlineSearch() {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) return

  await nextTick()
  inlineSearchEl.value?.focus()
}

// Labels are English only, matching the home_myquizz.html demo navigation.
// Create is a plain nav item like the others; only its session requirement differs.
const navLinks = [
  // Home matches "/", which prefixes every route, so it needs exact matching.
  { label: 'Home', to: { name: 'home' }, exact: true },
  { label: 'Discover', to: { name: 'discover' } },
  { label: 'My library', to: { name: 'library' } },
  { label: 'Create', to: { name: 'create-start' }, requiresAuth: true },
]

const visibleNavLinks = computed(() =>
  navLinks.filter((link) => !link.requiresAuth || (auth.ready && auth.isLoggedIn)),
)

/**
 * The avatar dropdown closes on any interaction outside of it: a click or tap
 * elsewhere, page scrolling, focus moving away with the tab key, or Escape.
 * The listeners only exist while the menu is open.
 */
function onDocumentPointerDown(event) {
  if (!menuRoot.value?.contains(event.target)) menuOpen.value = false
}

function closeMenu() {
  menuOpen.value = false
}

function onMenuFocusOut(event) {
  // relatedTarget is the element about to receive focus; null means focus left the page.
  const next = event.relatedTarget
  if (!next || !menuRoot.value?.contains(next)) menuOpen.value = false
}

function bindMenuDismissers() {
  // Capture phase, so the menu still closes if an inner handler stops propagation.
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  // The window is the scroller, so the plain scroll event fires here.
  window.addEventListener('scroll', closeMenu, { passive: true })
  window.addEventListener('blur', closeMenu)
}

function unbindMenuDismissers() {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('scroll', closeMenu)
  window.removeEventListener('blur', closeMenu)
}

watch(menuOpen, (open) => {
  if (open) bindMenuDismissers()
  else unbindMenuDismissers()
})

onBeforeUnmount(unbindMenuDismissers)

// The drawer covers the page, so background scrolling is paused while it is open.
watch(mobileOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

/**
 * Searching from Discover must not drop the filters already applied there, so the
 * current query is carried over and only the keyword is replaced.
 */
function submitSearch() {
  const carried = route.name === 'discover' ? { ...route.query } : {}

  router.push({
    name: 'discover',
    query: { ...carried, keyword: keyword.value || undefined },
  })
  mobileOpen.value = false
  searchOpen.value = false
}

async function handleLogout() {
  menuOpen.value = false
  mobileOpen.value = false
  await auth.logout()

  router.push({ name: 'home' })
}
</script>

<template>
  <!-- Translucent sticky bar with the demo's saturated backdrop blur. -->
  <header class="sticky top-0 z-50 border-b border-hairline bg-white/[0.86] backdrop-blur-[10px] backdrop-saturate-[180%]">
    <div class="container-page flex h-16 items-center gap-md">
      <RouterLink :to="{ name: 'home' }" class="flex shrink-0 items-center" aria-label="MyQuizz home">
        <BrandLogo :size="30" />
      </RouterLink>

      <!-- Primary navigation lives on the left, next to the logo. -->
      <nav class="hidden items-center gap-xxs md:flex">
        <RouterLink
          v-for="link in visibleNavLinks"
          :key="link.label"
          :to="link.to"
          class="nav-link"
          :active-class="link.exact ? '' : 'nav-link-active'"
          exact-active-class="nav-link-active"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-[10px]">
        <form class="hidden w-[220px] lg:block" @submit.prevent="submitSearch">
          <label class="field flex items-center gap-xs">
            <svg
              class="h-[15px] w-[15px] shrink-0 text-ink-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              v-model="keyword"
              class="w-full border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-3"
              type="search"
              placeholder="Search quizzes…"
            >
          </label>
        </form>

        <!--
          Between md and lg the bar has the full navigation but no room for the field,
          and that range has no hamburger to fall back on, so search opens on demand.
        -->
        <button
          class="icon-btn hidden md:grid lg:hidden"
          type="button"
          aria-label="Search quizzes"
          :aria-expanded="searchOpen"
          @click="toggleInlineSearch"
        >
          <svg
            class="h-[17px] w-[17px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>

        <RouterLink :to="{ name: 'join-game' }" class="btn-primary hidden sm:inline-flex">
          Join game
        </RouterLink>

        <!--
          The session is only known after the first /users/me probe. Until then no
          auth control is rendered at all, so the header never shows a wrong state.
        -->
        <div v-if="!auth.ready" class="h-[34px] w-[34px] shrink-0 rounded-full bg-canvas-soft" />

        <!-- Signed in: avatar only. The name and email live inside the dropdown. -->
        <div
          v-else-if="auth.isLoggedIn"
          ref="menuRoot"
          class="relative"
          @focusout="onMenuFocusOut"
          @keydown.esc="menuOpen = false"
        >
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
            >
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
              <p class="truncate text-body-sm font-medium text-ink">
                {{ auth.displayName }}
              </p>
              <p class="truncate text-caption text-ink-faint">
                {{ auth.user?.email }}
              </p>
            </div>
            <RouterLink
              :to="{ name: 'create-start' }"
              class="block rounded-md px-sm py-xs text-body-sm text-ink-secondary hover:bg-canvas-soft"
              role="menuitem"
              @click="menuOpen = false"
            >
              Create a quiz
            </RouterLink>
            <RouterLink
              :to="{ name: 'library' }"
              class="block rounded-md px-sm py-xs text-body-sm text-ink-secondary hover:bg-canvas-soft"
              role="menuitem"
              @click="menuOpen = false"
            >
              My library
            </RouterLink>
            <RouterLink
              :to="{ name: 'history' }"
              class="block rounded-md px-sm py-xs text-body-sm text-ink-secondary hover:bg-canvas-soft"
              role="menuitem"
              @click="menuOpen = false"
            >
              Play history
            </RouterLink>
            <RouterLink
              :to="{ name: 'profile' }"
              class="block rounded-md px-sm py-xs text-body-sm text-ink-secondary hover:bg-canvas-soft"
              role="menuitem"
              @click="menuOpen = false"
            >
              Edit profile
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

        <RouterLink v-else :to="{ name: 'login' }" class="btn-utility hidden sm:inline-flex">
          Log in
        </RouterLink>

        <button
          class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-md border border-hairline bg-surface text-ink md:hidden"
          type="button"
          aria-label="Menu"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = !mobileOpen"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="searchOpen" class="border-t border-hairline bg-surface lg:hidden">
      <div class="container-page py-sm">
        <form @submit.prevent="submitSearch">
          <input
            ref="inlineSearchEl"
            v-model="keyword"
            class="field"
            type="search"
            placeholder="Search quizzes…"
          >
        </form>
      </div>
    </div>
  </header>

  <!--
    Mobile menu: teleported out of the header so the header's own backdrop-filter
    cannot turn it into a containing block for these fixed elements. Left inside,
    the drawer and its backdrop would be clipped to the header's own box instead of
    the viewport, which is what made the menu look like it sat under the page.
  -->
  <Teleport to="body">
    <Transition name="drawer-backdrop">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-[100] bg-ink/40 md:hidden"
        @click="mobileOpen = false"
      />
    </Transition>
    <Transition name="drawer-panel">
      <aside
        v-if="mobileOpen"
        class="drawer-panel fixed inset-y-0 left-0 z-[101] flex w-[82vw] max-w-[320px] flex-col gap-lg overflow-y-auto bg-surface p-lg shadow-1 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        @keydown.esc="mobileOpen = false"
      >
        <div class="flex items-center justify-between">
          <RouterLink :to="{ name: 'home' }" class="flex items-center" aria-label="MyQuizz home" @click="mobileOpen = false">
            <BrandLogo :size="30" />
          </RouterLink>
          <button
            class="icon-btn"
            type="button"
            aria-label="Close menu"
            @click="mobileOpen = false"
          >
            <svg
              class="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="submitSearch">
          <input v-model="keyword" class="field" type="search" placeholder="Search quizzes…">
        </form>

        <nav class="flex flex-col gap-xxs">
          <RouterLink
            v-for="link in visibleNavLinks"
            :key="link.label"
            :to="link.to"
            class="nav-link nav-link-block"
            :active-class="link.exact ? '' : 'nav-link-active'"
            exact-active-class="nav-link-active"
            @click="mobileOpen = false"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <RouterLink :to="{ name: 'join-game' }" class="btn-primary" @click="mobileOpen = false">
          Join game
        </RouterLink>

        <div class="mt-auto flex flex-col gap-xs border-t border-hairline pt-lg">
          <!-- History is listed for guests too: their matches are kept per browser. -->
          <RouterLink :to="{ name: 'history' }" class="nav-link nav-link-block" @click="mobileOpen = false">
            Play history
          </RouterLink>
          <template v-if="auth.ready && auth.isLoggedIn">
            <RouterLink :to="{ name: 'profile' }" class="nav-link nav-link-block" @click="mobileOpen = false">
              Edit profile
            </RouterLink>
            <button class="btn-utility" type="button" @click="handleLogout">
              Log out
            </button>
          </template>
          <RouterLink
            v-else-if="auth.ready"
            :to="{ name: 'login' }"
            class="btn-utility"
            @click="mobileOpen = false"
          >
            Log in
          </RouterLink>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* One shared shape for every navigation entry, Create included. */
.nav-link {
  display: inline-flex;
  align-items: center;
  border-radius: var(--r-md);
  padding: 7px 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--ink-muted);
  transition:
    color 150ms ease,
    background-color 150ms ease,
    box-shadow 150ms ease;
}

.nav-link:hover {
  color: var(--ink);
  background-color: var(--canvas-soft);
}

.nav-link-block {
  display: block;
  font-size: 16px;
}

/* Active state: no pill and no outline, just full-strength ink and heavier weight. */
.nav-link-active,
.nav-link-active:hover {
  color: var(--ink);
  font-weight: 700;
  background-color: transparent;
}

/* Backdrop fades; the panel itself slides in from the left edge of the screen. */
.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active {
  transition: opacity 200ms ease;
}

.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to {
  opacity: 0;
}

.drawer-panel-enter-active,
.drawer-panel-leave-active {
  transition: transform 220ms ease;
}

.drawer-panel-enter-from,
.drawer-panel-leave-to {
  transform: translateX(-100%);
}
</style>
