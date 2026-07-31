<script setup>
// Warm canvas-soft footer band with a multi-column link directory, mirroring
// the home_myquizz.html demo footer.
import BrandLogo from '@/components/base/BrandLogo.vue'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-[40px] border-t border-hairline bg-canvas-soft">
    <div class="container-page pb-lg pt-[48px]">
      <div class="grid grid-cols-2 gap-xxl md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div class="col-span-2 lg:col-span-1">
          <BrandLogo :size="20" />
          <p class="mt-sm max-w-[280px] text-caption text-ink-muted">
            A calmer place to learn and play quizzes together — real-time or solo, at your own pace.
          </p>
        </div>

        <div>
          <h5 class="mb-sm text-eyebrow uppercase tracking-[0.5px] text-ink-faint">Product</h5>
          <RouterLink :to="{ name: 'discover' }" class="block py-[5px] text-caption text-ink-secondary hover:text-ink">
            Discover
          </RouterLink>
          <RouterLink :to="{ name: 'library' }" class="block py-[5px] text-caption text-ink-secondary hover:text-ink">
            My library
          </RouterLink>
          <RouterLink :to="{ name: 'discover' }" class="block py-[5px] text-caption text-ink-secondary hover:text-ink">
            Join a game
          </RouterLink>
        </div>

        <div>
          <h5 class="mb-sm text-eyebrow uppercase tracking-[0.5px] text-ink-faint">Company</h5>
          <span class="block py-[5px] text-caption text-ink-secondary">About</span>
          <span class="block py-[5px] text-caption text-ink-secondary">Blog</span>
          <span class="block py-[5px] text-caption text-ink-secondary">Careers</span>
        </div>

        <div>
          <h5 class="mb-sm text-eyebrow uppercase tracking-[0.5px] text-ink-faint">Resources</h5>
          <span class="block py-[5px] text-caption text-ink-secondary">Help center</span>
          <span class="block py-[5px] text-caption text-ink-secondary">Privacy</span>
          <span class="block py-[5px] text-caption text-ink-secondary">Terms</span>
        </div>
      </div>
    </div>

    <div class="container-page flex flex-wrap items-center justify-between gap-xs border-t border-hairline py-[18px] text-[13px] text-ink-faint">
      <span>&copy; {{ year }} MyQuizz</span>
      <span>Create quizzes, play together, follow results in real time.</span>
    </div>
  </footer>
</template>
