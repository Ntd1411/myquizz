/**
 * Hand-off of the reset ticket between the two screens of a password reset.
 *
 * POST /users/password-reset/verify answers with a ticket, and that ticket is the only
 * thing POST /users/password-reset/complete accepts. It is kept here instead of in the
 * URL on purpose: a credential in a link ends up in browser history, in chat logs and
 * in referrers, which is exactly what splitting the proof from the write was meant to
 * stop. sessionStorage also scopes it to the tab that proved the email, so a second tab
 * cannot finish a reset it never verified, and closing the tab throws it away.
 */
const TICKET_KEY = 'myquizz:reset_ticket'

function toDeadline(value) {
  if (!value) return 0
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? 0 : at
}

export function clearResetTicket() {
  sessionStorage.removeItem(TICKET_KEY)
}

export function saveResetTicket({ ticket, expiresAt, email }) {
  sessionStorage.setItem(TICKET_KEY, JSON.stringify({ ticket, expiresAt, email }))
}

/**
 * Returns null as soon as there is nothing usable left - no entry, unreadable JSON, or
 * a ticket past its own deadline - so a stale entry can never render a form the backend
 * would refuse. The server still has the last word: the deadline stored here is only
 * used to avoid asking about a ticket that is already dead.
 */
export function loadResetTicket() {
  const raw = sessionStorage.getItem(TICKET_KEY)
  if (!raw) return null

  let saved = null
  try {
    saved = JSON.parse(raw)
  } catch {
    clearResetTicket()
    return null
  }

  if (!saved || !saved.ticket) {
    clearResetTicket()
    return null
  }

  const expiresAt = toDeadline(saved.expiresAt)
  if (expiresAt && expiresAt <= Date.now()) {
    clearResetTicket()
    return null
  }

  return {
    ticket: saved.ticket,
    expiresAt: saved.expiresAt || '',
    email: saved.email || '',
  }
}
