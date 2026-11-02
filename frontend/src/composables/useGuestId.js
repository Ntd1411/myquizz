const STORAGE_KEY = 'player_guest_id'
const TOKEN_KEY = 'player_guest_token'

/**
 * Guests are identified by a UUID persisted in localStorage. The backend uses it to
 * reconnect a disconnected guest to the same player row, so it must survive reloads.
 */
export function useGuestId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

export function readGuestToken() {
  return window.localStorage.getItem(TOKEN_KEY) || null
}

export function saveGuestToken(token) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
}

function fallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
