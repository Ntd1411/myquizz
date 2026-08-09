<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizRail from '@/components/quiz/QuizRail.vue'
import { searchQuizzes } from '@/api/quizzes.api'
import { CATEGORIES, GAME_MODES } from '@/constants/quizMeta'
import { revealOnScroll } from '@/composables/useMotion'

// The page opens directly on Trending. There is no hero band on purpose.
// The backend caps `limit` at 24, which is one pool request for every rail here.
// Server-driven rows from GET /quizzes/home replace this pool in the next PR.
const POOL_LIMIT = 24

// Category swatches and mode blurbs are static UI copy (src/constants/quizMeta.js).
// Decoration only: a swatch never paints a CTA or a structural fill.

const pageEl = ref(null)
const staticEl = ref(null)

// A single pool request feeds every rail on this page, so the home screen costs
// one round trip instead of one per category.
const pool = useQuery({
  queryKey: ['quizzes', 'home-pool'],
  queryFn: () => searchQuizzes({ limit: POOL_LIMIT, sort: 'newest' }),
})

const quizzes = computed(() => pool.data.value?.quizzes ?? [])

const trending = computed(() =>
  [...quizzes.value].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0)),
)

// The backend has no dedicated "newest" endpoint yet, so sort the same search
// result client-side by creation date. Swap this for a sort param once it exists.
const newest = computed(() =>
  [...quizzes.value].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)),
)

// Only categories that actually have quizzes get their own rail.
const topicRails = computed(() =>
  CATEGORIES.map((category) => ({
    ...category,
    items: quizzes.value.filter((quiz) => quiz.category === category.name),
  })).filter((topic) => topic.items.length > 0),
)

function countFor(name) {
  return quizzes.value.filter((quiz) => quiz.category === name).length
}

function topicId(name) {
  return `topic-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/** Scrolls to a topic rail through Lenis when smooth scrolling is active. */
function scrollToTopic(name) {
  const target = document.getElementById(topicId(name))
  if (!target) return
  if (window.__lenis) {
    window.__lenis.scrollTo(target, { offset: -72, duration: 1.2 })
    return
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // Rails animate their own title and cards, so this only covers the static
  // sections (topic chips, game modes) further down the page.
  revealOnScroll(pageEl.value, '[data-reveal]')
  revealOnScroll(staticEl.value, '[data-reveal-static]', { y: 20, stagger: 0.06 })
})
</script>

<template>
  <div ref="pageEl" class="pb-xxl pt-md">
    <QuizRail
      title="Trending quizzes"
      :items="trending"
      :loading="pool.isLoading.value"
      :see-all-to="{ name: 'discover' }"
      see-all-label="See all"
    />

    <QuizRail
      title="Newest quizzes"
      :items="newest"
      :loading="pool.isLoading.value"
      :see-all-to="{ name: 'discover', query: { sort: 'newest' } }"
      see-all-label="See all"
    />

    <section ref="staticEl" class="container-page py-lg">
      <h2 class="section-title mb-[20px]" data-reveal-static>
        Trending topics
      </h2>
      <div class="flex flex-wrap gap-[10px]" data-reveal-static>
        <button
          v-for="category in CATEGORIES"
          :key="category.name"
          type="button"
          class="chip"
          @click="scrollToTopic(category.name)"
        >
          <span class="h-[9px] w-[9px] rounded-full" :style="{ backgroundColor: category.color }" />
          {{ category.name }}
          <span class="text-[13px] text-ink-faint">{{ countFor(category.name) }}</span>
        </button>
      </div>
    </section>

    <div v-for="topic in topicRails" :id="topicId(topic.name)" :key="topic.name">
      <QuizRail
        :title="topic.name"
        :swatch-color="topic.color"
        :items="topic.items"
        :see-all-to="{ name: 'discover', query: { category: topic.name } }"
        see-all-label="See all"
      />
    </div>

    <section class="container-page py-lg" data-reveal>
      <h2 class="section-title mb-[20px]">
        Game modes
      </h2>
      <div class="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="mode in GAME_MODES"
          :key="mode.name"
          class="card-surface px-lg py-[22px]"
        >
          <h3 class="text-title text-ink">
            {{ mode.name }}
          </h3>
          <p class="mt-xxs text-body-sm text-ink-muted">
            {{ mode.desc }}
          </p>
        </article>
      </div>
    </section>

    <p v-if="pool.isError.value" class="container-page text-body-sm text-sticker-orange-deep">
      Could not load quizzes. Please check your connection to the server.
    </p>
  </div>
</template>
