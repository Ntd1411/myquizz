import { onMounted, onBeforeUnmount, ref } from 'vue'
import { googleOneTap } from '@/api/auth.api'

/**
 * Google Identity Services (One Tap + rendered button).
 *
 * Flow: GIS returns a Google ID token in the browser, we POST it to
 * /auth/google/one-tap, and the backend verifies it and sets the same HttpOnly
 * cookies as the redirect flow. No token is ever stored in JavaScript.
 *
 * Requirements:
 * - VITE_GOOGLE_CLIENT_ID must be the same Google client id the backend uses.
 * - The origin must be registered as an "Authorized JavaScript origin" in the
 *   Google Cloud console (http://localhost:5173 for local dev).
 */
const GSI_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise = null

// GIS keeps one global identity context per page load. Calling initialize() again
// replaces the previous configuration and logs a warning, which is what happened
// every time the login route was mounted a second time. So the library is configured
// once per client id, and the callback it receives is a stable dispatcher that
// forwards to whichever consumer is mounted at that moment.
let initializedClientId = null
let activeHandler = null

function dispatchCredential(response) {
  activeHandler?.(response)
}

/** Loads the GIS script once per page load. */
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
      const script = existing ?? document.createElement('script')

      script.addEventListener('load', () => resolve(window.google))
      script.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')))

      if (!existing) {
        script.src = GSI_SRC
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
    })
  }

  return scriptPromise
}

/**
 * @param {object} options
 * @param {import('vue').Ref<HTMLElement|null>} [options.buttonEl] Container for the rendered
 *   "Sign in with Google" button.
 * @param {boolean} [options.prompt] Whether to also show the One Tap prompt.
 * @param {boolean} [options.enabled] Skip entirely when the user is already signed in.
 * @param {(user: object) => void} [options.onSuccess]
 * @param {(error: unknown) => void} [options.onError]
 */
export function useGoogleOneTap({ buttonEl, prompt = true, enabled = true, onSuccess, onError } = {}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const available = ref(Boolean(clientId))

  async function handleCredential(response) {
    try {
      const user = await googleOneTap(response.credential)
      onSuccess?.(user)
    } catch (error) {
      onError?.(error)
    }
  }

  onMounted(async () => {
    if (!enabled || !clientId) {
      // Without a client id One Tap cannot initialise; the redirect flow still works.
      if (!clientId) console.warn('[auth] VITE_GOOGLE_CLIENT_ID is not set, Google One Tap is disabled.')
      return
    }

    try {
      const google = await loadGsi()

      // This instance is the live one, so it takes over the credential callback.
      activeHandler = handleCredential

      if (initializedClientId !== clientId) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: dispatchCredential,
          // The backend verifies the token, so FedCM/auto-select are safe here.
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        })
        initializedClientId = clientId
      }

      if (buttonEl?.value) {
        google.accounts.id.renderButton(buttonEl.value, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: buttonEl.value.offsetWidth || 320,
        })
      }

      if (prompt) google.accounts.id.prompt()
    } catch (error) {
      available.value = false
      onError?.(error)
    }
  })

  onBeforeUnmount(() => {
    // Only release the dispatcher if this instance still owns it. A newer consumer
    // that mounted before this one unmounted must keep its own callback.
    if (activeHandler === handleCredential) activeHandler = null

    // Closing the prompt avoids a stale overlay after navigating away.
    window.google?.accounts?.id?.cancel()
  })

  return { available }
}
