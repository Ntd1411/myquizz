<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="container-page flex flex-col items-center gap-sm py-xxl text-center">
    <p class="text-display-2 text-ink">
      404
    </p>
    <p class="text-body-md text-ink-muted">
      The page you are looking for does not exist.
    </p>
    <RouterLink :to="{ name: 'home' }" class="btn-primary mt-sm">
      Back to home
    </RouterLink>
  </div>
</template>
