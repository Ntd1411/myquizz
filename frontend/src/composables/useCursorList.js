import { ref, computed, watch, toValue } from 'vue'
import { toErrorMessage } from '@/api/envelope'

/**
 * Cursor (keyset) list state for the quiz listing endpoints.
 *
 * The backend binds a cursor to the sort and to the full filter set it was issued
 * for, so any filter change has to restart from the first page. That is exactly what
 * this composable does: it watches the params getter and reloads page one, then
 * appends pages through `loadMore()` while `hasMore` is true.
 *
 * TanStack Query is intentionally not used here. Its cache key would keep stale
 * cursors alive across filter changes, which is the one thing the backend rejects.
 *
 * @param fetchPage - (params) => Promise<{ quizzes, pagination }>
 * @param params - getter returning the current filter params
 * @param options.enabled - getter; the list stays idle while it is false
 * @param options.includeTotal - ask for meta.pagination.total on the first page
 * @param options.errorFallback - message used when the error carries none
 */
export function useCursorList(fetchPage, params, options = {}) {
  const items = ref([])
  const cursor = ref(null)
  const hasMore = ref(false)
  const total = ref(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const errorMessage = ref('')

  // Only the newest request may write to the state: a fast filter change can
  // otherwise be overwritten by a slower earlier response.
  let requestId = 0

  const isEmpty = computed(
    () => !loading.value && !errorMessage.value && items.value.length === 0,
  )

  async function load({ append }) {
    if (options.enabled !== undefined && !toValue(options.enabled)) return

    const id = requestId + 1
    requestId = id

    const query = { ...toValue(params) }
    if (append) query.cursor = cursor.value
    else if (options.includeTotal) query.includeTotal = true

    if (append) loadingMore.value = true
    else loading.value = true
    errorMessage.value = ''

    try {
      const page = await fetchPage(query)
      if (id !== requestId) return

      items.value = append ? [...items.value, ...page.quizzes] : page.quizzes
      cursor.value = page.pagination.nextCursor ?? null
      hasMore.value = Boolean(page.pagination.hasMore)
      if (!append) total.value = page.pagination.total ?? null
    } catch (error) {
      if (id !== requestId) return

      errorMessage.value = toErrorMessage(error, options.errorFallback)
      if (!append) {
        items.value = []
        cursor.value = null
        hasMore.value = false
        total.value = null
      }
    } finally {
      if (id === requestId) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  function loadFirst() {
    cursor.value = null
    hasMore.value = false
    return load({ append: false })
  }

  function loadMore() {
    if (!hasMore.value || !cursor.value || loading.value || loadingMore.value) return
    return load({ append: true })
  }

  watch(
    [() => toValue(params), () => (options.enabled === undefined ? true : toValue(options.enabled))],
    () => {
      loadFirst()
    },
    { deep: true, immediate: true },
  )

  return {
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    errorMessage,
    isEmpty,
    loadFirst,
    loadMore,
  }
}
