import { afterEach, vi } from 'vitest'

/**
 * Global test setup.
 *
 * Keep this file small. Anything that only two or three specs need belongs in
 * those specs, not here: a fat setup file makes every test depend on state it
 * never asked for, which is exactly the thing that makes a suite hard to trust.
 */

// happy-dom does not implement matchMedia, and the motion helpers call it to
// honour prefers-reduced-motion. Tests run with motion disabled, which also keeps
// component specs free of animation timing.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// IntersectionObserver drives the infinite feed. A stub that never fires is the
// honest default: a spec that wants a scroll event should install its own.
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

afterEach(() => {
  // Player seats live in sessionStorage and guest ids in localStorage. Leaking
  // them between tests would make specs pass or fail depending on their order.
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
