import crypto from 'crypto'

/**
 * Six digits out of the CSPRNG. Math.random() is seeded state rather than
 * entropy, and the whole value of a code is that seeing one tells you nothing
 * about the next. randomInt is uniform over the range, so padStart is what
 * keeps a code that begins with a zero six characters long.
 */
export function generateOTP(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// Travels inside the emailed link, so hex keeps it URL-safe without encoding.
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Handed out once the OTP or the emailed link has been verified, and accepted
 * by nothing except the endpoint that writes the new password. It travels in a
 * JSON body rather than a URL, so base64url only makes it shorter.
 */
export function generateResetTicket(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Turns demo@myquizz.com into de**@myquizz.com. The reset pages can then say
 * which address the code went to without printing an address that whoever
 * opened the link did not already know.
 */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const visible = local.slice(0, 2)
  const hidden = '*'.repeat(Math.max(local.length - visible.length, 1))

  return `${visible}${hidden}@${domain}`
}
