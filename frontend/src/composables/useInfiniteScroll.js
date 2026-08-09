import { onBeforeUnmount, onMounted, toValue, watch } from 'vue'

/**
 * Calls `onHit` every time a sentinel element enters the viewport.
 *
 * Used by the home feed: the sentinel sits under the last card, so reaching the end
 * of the list asks for the next cursor page instead of showing a button. The observer
 * is rebuilt when the element reference changes, because the sentinel only exists
 * once the first page has rendered.
 *
 * `rootMargin` fires the callback before the sentinel is actually visible, which
 * hides the request latency.
 */
export function useInfiniteScroll(sentinel, onHit, options = {}) {
  let observer = null

  function disconnect() {
    if (!observer) return
    observer.disconnect()
    observer = null
  }

  function observe() {
    disconnect()

    const target = toValue(sentinel)
    // IntersectionObserver is missing in non-browser environments only.
    if (!target || typeof IntersectionObserver !== 'function') return

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onHit()
      },
      { rootMargin: options.rootMargin ?? '320px 0px' },
    )
    observer.observe(target)
  }

  onMounted(observe)
  watch(() => toValue(sentinel), observe)
  onBeforeUnmount(disconnect)

  return { observe, disconnect }
}
