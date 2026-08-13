<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from '@/components/base/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { uploadImage } from '@/api/storage.api'
import {
  updateMe,
  changePassword,
  updateAvatar,
  deactivateAccount,
  forgotPassword,
} from '@/api/users.api'
import { toTextParts } from '@/utils/linkify'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * Account settings, wired to the backend user module:
 *   PATCH  /users/me                profile fields
 *   PATCH  /users/me/avatar         avatar URL from /storage/presign
 *   PATCH  /users/me/password       password change (knows the old password)
 *   POST   /users/forgot-password   emailed reset code (forgot the old password)
 *   DELETE /users/me                deactivate (soft delete)
 *
 * The header is the same card the library and the public profile show, so the reader
 * edits exactly what other people see, in the layout they see it in. There is no
 * separate edit screen: a pencil swaps that one line for an input in place, the rest
 * of the card stays readable, and Save appears at the top of the card as soon as any
 * value differs from the stored one.
 *
 * The page reads the session store rather than fetching: this is always the signed-in
 * account, and /users/me already ran before the first navigation.
 *
 * Email has no pencil. Google sign-in falls back to matching an account by address, so
 * an edited email would strand the account and mint a duplicate on the next sign-in.
 * The backend refuses the field outright; here it is simply not editable.
 *
 * Client-side rules mirror updateProfileSchema exactly so a valid form never gets a
 * 400 back: fullname 2-100, phone 7-15 digits with an optional "+", description at most
 * 200 characters. They run while typing, not on submit, so the error sits under the
 * field that caused it.
 */
const LIMITS = { nameMin: 2, nameMax: 100, descriptionMax: 200, passwordMin: 8 }
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/

// "Member since August 2026": a join date needs no day to be useful.
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

const PROFILE_FIELDS = ['fullname', 'phone', 'description']

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const pageEl = ref(null)

// The three editable values, plus which of them are currently swapped for an input.
const form = reactive({ fullname: '', phone: '', description: '' })
const open = reactive({ fullname: false, phone: false, description: false })

const nameInput = ref(null)
const phoneInput = ref(null)
const bioInput = ref(null)
const FOCUS_TARGETS = {
  fullname: nameInput,
  phone: phoneInput,
  description: bioInput,
}

const profileError = ref('')
const savingProfile = ref(false)

const avatarUploading = ref(false)
const avatarInput = ref(null)

// 'none' | 'change' | 'reset' - only one password flow is visible at a time.
const passwordMode = ref('none')
const passwords = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref('')
const savingPassword = ref(false)
const sendingReset = ref(false)

const dangerOpen = ref(false)
const dangerPassword = ref('')
const dangerError = ref('')
const deactivating = ref(false)

const displayName = computed(() => auth.user?.fullname || 'Your account')

const avatarUrl = computed(() => auth.user?.avatar || '')

const email = computed(() => auth.user?.email || '')

const phone = computed(() => auth.user?.phone || '')

const bio = computed(() => auth.user?.description?.trim() || '')

const publicRoute = computed(() =>
  auth.user?.id ? { name: 'user-profile', params: { id: auth.user.id } } : null,
)

const memberSince = computed(() => {
  const raw = auth.user?.created_at ?? auth.user?.createdAt
  if (!raw) return ''

  const joined = new Date(raw)
  if (Number.isNaN(joined.getTime())) return ''

  return `Member since ${MONTH_YEAR.format(joined)}`
})

// Links pasted into the intro are clickable, here and on the two cards that show the
// same intro to other people.
const bioParts = computed(() => toTextParts(bio.value))

/**
 * Same rule as the library card: a badge only earns its space when it says something,
 * so a local account with the plain 'user' role shows none. The field names are the
 * backend ones - the session row carries auth_provider and google_id, not camelCase.
 */
const isGoogleAccount = computed(
  () => auth.user?.auth_provider === 'google' || Boolean(auth.user?.google_id),
)

const accountBadges = computed(() => {
  const badges = []
  const role = auth.user?.role

  if (role && role !== 'user') {
    badges.push({
      key: 'role',
      label: role.charAt(0).toUpperCase() + role.slice(1),
      tone: 'brand',
    })
  }

  if (isGoogleAccount.value) {
    badges.push({ key: 'provider', label: 'Google', tone: 'neutral' })
  }

  return badges
})

function storedValue(field) {
  return auth.user?.[field] ?? ''
}

function fillFromStore() {
  for (const field of PROFILE_FIELDS) form[field] = storedValue(field)
}

onMounted(() => {
  fillFromStore()
  revealOnEnter(pageEl.value)
})

// The session probe may land after this page mounts on a hard refresh. Never clobber a
// field the user is currently typing in.
watch(
  () => auth.user,
  () => {
    for (const field of PROFILE_FIELDS) {
      if (!open[field]) form[field] = storedValue(field)
    }
  },
)

/** Only changed fields are sent, so an untouched phone is never re-checked. */
function buildProfilePatch() {
  const patch = {}
  for (const field of PROFILE_FIELDS) {
    const next = form[field].trim()
    if (next !== storedValue(field)) patch[field] = next
  }
  return patch
}

const hasProfileChanges = computed(() => Object.keys(buildProfilePatch()).length > 0)

/**
 * Validation runs on every keystroke rather than on submit, but only for a field the
 * reader has actually opened or changed - an account that predates the phone rule
 * should not be scolded about a value it was never asked for.
 */
const fieldErrors = computed(() => {
  const errors = {}

  const fullname = form.fullname.trim()
  if (open.fullname || fullname !== storedValue('fullname')) {
    if (fullname.length < LIMITS.nameMin) {
      errors.fullname = `Full name must be at least ${LIMITS.nameMin} characters.`
    } else if (fullname.length > LIMITS.nameMax) {
      errors.fullname = `Full name must be at most ${LIMITS.nameMax} characters.`
    }
  }

  const phoneValue = form.phone.trim()
  if ((open.phone || phoneValue !== storedValue('phone')) && phoneValue) {
    if (!PHONE_PATTERN.test(phoneValue)) {
      errors.phone = 'Phone must be 7 to 15 digits, with an optional leading +.'
    }
  }

  if (form.description.trim().length > LIMITS.descriptionMax) {
    errors.description = `About you must be at most ${LIMITS.descriptionMax} characters.`
  }

  return errors
})

const hasFieldErrors = computed(() => Object.keys(fieldErrors.value).length > 0)

/** A pencil turns one line into an input in place and puts the caret in it. */
async function openField(field) {
  profileError.value = ''
  form[field] = storedValue(field)
  open[field] = true

  await nextTick()
  FOCUS_TARGETS[field]?.value?.focus()
}

function closeField(field) {
  form[field] = storedValue(field)
  open[field] = false
}

/**
 * Leaving an untouched field puts the line back; a field with pending text stays open,
 * because collapsing it would hide an edit the reader has not saved yet.
 */
function onFieldBlur(field) {
  if (form[field].trim() === storedValue(field)) open[field] = false
}

function cancelEdits() {
  fillFromStore()
  for (const field of PROFILE_FIELDS) open[field] = false
  profileError.value = ''
}

async function saveProfile() {
  profileError.value = ''

  const patch = buildProfilePatch()
  if (!Object.keys(patch).length || hasFieldErrors.value) return

  savingProfile.value = true
  try {
    // The endpoint answers with the whole row, so the store is replaced rather than
    // patched: the header, the nav avatar and this card all read the same object.
    const updated = await updateMe(patch)
    auth.setUser(updated)
    for (const field of PROFILE_FIELDS) open[field] = false
    ui.toast('Your profile has been updated.', 'success')
  } catch (error) {
    // A duplicate phone comes back as a plain 400 from the backend.
    profileError.value = toErrorMessage(error, 'Could not update your profile.')
  } finally {
    savingProfile.value = false
  }
}

async function onAvatarPicked(event) {
  const file = event.target.files?.[0]
  if (!file) return

  avatarUploading.value = true
  try {
    // Two steps on purpose: presigned upload to storage, then the URL to the user API.
    const publicUrl = await uploadImage(file, 'avatars')
    const avatar = await updateAvatar(publicUrl)
    auth.patchUser({ avatar: avatar || publicUrl })
    ui.toast('Your avatar has been updated.', 'success')
  } catch (error) {
    ui.toast(toErrorMessage(error, 'Could not upload the image.'), 'error')
  } finally {
    avatarUploading.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

function openPasswordMode(mode) {
  passwordMode.value = passwordMode.value === mode ? 'none' : mode
  passwordError.value = ''
  passwords.oldPassword = ''
  passwords.newPassword = ''
  passwords.confirmPassword = ''
}

async function savePassword() {
  passwordError.value = ''

  if (passwords.newPassword.length < LIMITS.passwordMin) {
    passwordError.value = `New password must be at least ${LIMITS.passwordMin} characters.`
    return
  }
  if (passwords.newPassword !== passwords.confirmPassword) {
    passwordError.value = 'The two new passwords do not match.'
    return
  }
  if (passwords.newPassword === passwords.oldPassword) {
    passwordError.value = 'The new password must differ from the current one.'
    return
  }

  savingPassword.value = true
  try {
    await changePassword({
      oldPassword: passwords.oldPassword,
      newPassword: passwords.newPassword,
    })
    passwordMode.value = 'none'
    passwords.oldPassword = ''
    passwords.newPassword = ''
    passwords.confirmPassword = ''
    ui.toast('Your password has been changed.', 'success')
  } catch (error) {
    // 400 means the current password is wrong; 429 comes from the auth rate limiter.
    passwordError.value = toErrorMessage(error, 'Could not change your password.')
  } finally {
    savingPassword.value = false
  }
}

/**
 * Reset path for people who cannot recall the current password: it reuses the public
 * forgot-password endpoint and then hands over to the reset screen, which already
 * handles the emailed code and its countdown.
 */
async function sendResetCode() {
  passwordError.value = ''
  if (!email.value) return

  sendingReset.value = true
  try {
    const resetTime = await forgotPassword(email.value)
    ui.toast('We emailed you a reset code.', 'success')
    router.push({
      name: 'reset-password',
      query: { email: email.value, resetTime: resetTime ?? undefined },
    })
  } catch (error) {
    passwordError.value = toErrorMessage(error, 'Could not send the reset code.')
  } finally {
    sendingReset.value = false
  }
}

async function confirmDeactivate() {
  dangerError.value = ''
  if (dangerPassword.value.length < LIMITS.passwordMin) {
    dangerError.value = 'Enter your current password to confirm.'
    return
  }

  deactivating.value = true
  try {
    await deactivateAccount(dangerPassword.value)
    dangerPassword.value = ''
    // The account is gone for every future request, so drop the local session too.
    await auth.logout()
    ui.toast('Your account has been deactivated.')
    router.push({ name: 'home' })
  } catch (error) {
    dangerError.value = toErrorMessage(error, 'Could not deactivate your account.')
  } finally {
    deactivating.value = false
  }
}
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <!-- The card a visitor sees, with a pencil on everything that can be changed. -->
    <section class="profile-card" data-enter>
      <div class="profile-avatar">
        <UserAvatar :name="displayName" :src="avatarUrl" :size="84" />

        <label class="avatar-edit" :title="avatarUploading ? 'Uploading…' : 'Change your avatar'">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
            <circle cx="12" cy="12.5" r="3.2" />
          </svg>
          <input
            ref="avatarInput"
            class="hidden"
            type="file"
            accept="image/*"
            :disabled="avatarUploading"
            @change="onAvatarPicked"
          >
          <span class="sr-only">Change your avatar</span>
        </label>
      </div>

      <div class="profile-main">
        <p class="eyebrow-label">
          Account
        </p>

        <!-- Name: badges ride the same line, and the pencil swaps the heading for an
             input without moving anything else. -->
        <div class="profile-headline">
          <template v-if="!open.fullname">
            <h1 class="profile-name">
              {{ displayName }}
            </h1>

            <p v-if="accountBadges.length" class="profile-badges">
              <span
                v-for="badge in accountBadges"
                :key="badge.key"
                class="badge"
                :class="`badge-${badge.tone}`"
              >
                {{ badge.label }}
              </span>
            </p>

            <button
              class="edit-pen"
              type="button"
              title="Edit your name"
              @click="openField('fullname')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span class="sr-only">Edit your name</span>
            </button>
          </template>

          <input
            v-else
            ref="nameInput"
            v-model="form.fullname"
            class="inline-input inline-name"
            type="text"
            autocomplete="name"
            aria-label="Full name"
            placeholder="Your name"
            :maxlength="LIMITS.nameMax"
            @blur="onFieldBlur('fullname')"
            @keydown.enter.prevent="saveProfile"
            @keydown.esc="closeField('fullname')"
          >
        </div>

        <p v-if="fieldErrors.fullname" class="inline-error">
          {{ fieldErrors.fullname }}
        </p>

        <!--
          One labelled fact per line, in the same order as the library and the public
          profile. Email is identity rather than a setting, so it is the only row here
          without a pencil.
        -->
        <div class="profile-meta">
          <p class="meta-row">
            <span class="meta-key">Email:</span>
            <span class="meta-value">{{ email }}</span>
          </p>

          <div class="meta-row">
            <span class="meta-key">Phone:</span>
            <template v-if="!open.phone">
              <span :class="phone ? 'meta-value' : 'meta-value is-empty'">
                {{ phone || 'No phone number' }}
              </span>
              <button
                class="edit-pen"
                type="button"
                title="Edit your phone number"
                @click="openField('phone')"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                <span class="sr-only">Edit your phone number</span>
              </button>
            </template>

            <input
              v-else
              ref="phoneInput"
              v-model="form.phone"
              class="inline-input inline-phone"
              type="tel"
              autocomplete="tel"
              aria-label="Phone number"
              placeholder="+84901234567"
              @blur="onFieldBlur('phone')"
              @keydown.enter.prevent="saveProfile"
              @keydown.esc="closeField('phone')"
            >
          </div>

          <p v-if="fieldErrors.phone" class="inline-error">
            {{ fieldErrors.phone }}
          </p>

          <p v-if="memberSince" class="meta-row meta-since">
            {{ memberSince }}
          </p>
        </div>

        <div class="profile-bio-row">
          <template v-if="!open.description">
            <p class="profile-bio" :class="bio ? '' : 'is-empty'">
              <template v-if="bio">
                <template v-for="part in bioParts" :key="part.key">
                  <a
                    v-if="part.type === 'link'"
                    :href="part.href"
                    class="bio-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ part.text }}</a>
                  <span v-else>{{ part.text }}</span>
                </template>
              </template>
              <template v-else>
                No intro yet. Add one so players know who is behind your quizzes.
              </template>
            </p>
            <button
              class="edit-pen"
              type="button"
              title="Edit your intro"
              @click="openField('description')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span class="sr-only">Edit your intro</span>
            </button>
          </template>

          <div v-else class="inline-bio-editor">
            <textarea
              ref="bioInput"
              v-model="form.description"
              class="inline-input inline-bio"
              aria-label="About you"
              placeholder="Introduce yourself: who you are and what you like to quiz about. Links are clickable."
              :maxlength="LIMITS.descriptionMax"
              @blur="onFieldBlur('description')"
              @keydown.esc="closeField('description')"
            />
            <span class="inline-count">
              {{ form.description.length }} / {{ LIMITS.descriptionMax }}
            </span>
          </div>
        </div>

        <p v-if="fieldErrors.description" class="inline-error">
          {{ fieldErrors.description }}
        </p>

        <p v-if="profileError" class="inline-error">
          {{ profileError }}
        </p>
      </div>

      <!--
        Save and Cancel only exist once something has actually changed. The link out is
        not an edit, so it stays: this card is what a visitor sees, and the fastest way
        to check that is to go and look at it.
      -->
      <div class="profile-actions">
        <template v-if="hasProfileChanges">
          <button
            class="btn-primary"
            type="button"
            :disabled="savingProfile || hasFieldErrors"
            @click="saveProfile"
          >
            {{ savingProfile ? 'Saving…' : 'Save' }}
          </button>
          <button class="btn-ghost" type="button" :disabled="savingProfile" @click="cancelEdits">
            Cancel
          </button>
        </template>

        <RouterLink v-if="publicRoute" :to="publicRoute" class="btn-ghost">
          View public profile
        </RouterLink>
      </div>
    </section>

    <!-- Password: two entry points, nothing expanded by default -->
    <section class="panel" data-enter>
      <h2 class="panel-title">
        Password
      </h2>

      <p v-if="isGoogleAccount" class="panel-text">
        This account signs in with Google, so it has no password to change.
      </p>

      <template v-else>
        <div class="mt-md grid gap-xs">
          <button
            class="password-option"
            type="button"
            :class="passwordMode === 'change' ? 'is-open' : ''"
            @click="openPasswordMode('change')"
          >
            <span>
              <span class="block text-body-sm font-medium text-ink">Change password</span>
              <span class="block text-caption text-ink-faint">You know your current password.</span>
            </span>
            <span class="password-option-caret" aria-hidden="true">›</span>
          </button>

          <button
            class="password-option"
            type="button"
            :class="passwordMode === 'reset' ? 'is-open' : ''"
            @click="openPasswordMode('reset')"
          >
            <span>
              <span class="block text-body-sm font-medium text-ink">Reset password</span>
              <span class="block text-caption text-ink-faint">Forgot it? Get a code by email.</span>
            </span>
            <span class="password-option-caret" aria-hidden="true">›</span>
          </button>
        </div>

        <form
          v-if="passwordMode === 'change'"
          class="edit-form mt-md border-t border-hairline pt-md"
          @submit.prevent="savePassword"
        >
          <label class="form-field">
            <span class="form-label">Current password</span>
            <input
              v-model="passwords.oldPassword"
              class="field"
              type="password"
              autocomplete="current-password"
            >
          </label>

          <label class="form-field">
            <span class="form-label">New password</span>
            <input
              v-model="passwords.newPassword"
              class="field"
              type="password"
              autocomplete="new-password"
            >
            <span class="form-hint">At least {{ LIMITS.passwordMin }} characters.</span>
          </label>

          <label class="form-field">
            <span class="form-label">Confirm new password</span>
            <input
              v-model="passwords.confirmPassword"
              class="field"
              type="password"
              autocomplete="new-password"
            >
          </label>

          <p v-if="passwordError" class="form-error">
            {{ passwordError }}
          </p>

          <div class="form-actions">
            <button
              class="btn-primary"
              type="submit"
              :disabled="savingPassword || !passwords.oldPassword || !passwords.newPassword"
            >
              {{ savingPassword ? 'Saving…' : 'Change password' }}
            </button>
            <button class="btn-ghost" type="button" :disabled="savingPassword" @click="passwordMode = 'none'">
              Cancel
            </button>
          </div>
        </form>

        <div v-else-if="passwordMode === 'reset'" class="mt-md border-t border-hairline pt-md">
          <p class="panel-text">
            We send a 6-digit code to <span class="text-ink">{{ email }}</span>. The next screen
            asks for that code and your new password.
          </p>

          <p v-if="passwordError" class="form-error mt-xs">
            {{ passwordError }}
          </p>

          <div class="form-actions mt-md">
            <button class="btn-primary" type="button" :disabled="sendingReset" @click="sendResetCode">
              {{ sendingReset ? 'Sending…' : 'Send reset code' }}
            </button>
            <button class="btn-ghost" type="button" :disabled="sendingReset" @click="passwordMode = 'none'">
              Cancel
            </button>
          </div>
        </div>
      </template>
    </section>

    <!-- Deactivate -->
    <section class="panel" data-enter>
      <h2 class="panel-title">
        Deactivate account
      </h2>
      <p class="panel-text">
        Your quizzes stop being playable and you are signed out everywhere. Support can
        restore the account later.
      </p>

      <button v-if="!dangerOpen" class="btn-utility mt-md" type="button" @click="dangerOpen = true">
        Deactivate my account
      </button>

      <form v-else class="edit-form mt-md" @submit.prevent="confirmDeactivate">
        <label class="form-field">
          <span class="form-label">Confirm with your password</span>
          <input
            v-model="dangerPassword"
            class="field"
            type="password"
            autocomplete="current-password"
          >
        </label>

        <p v-if="dangerError" class="form-error">
          {{ dangerError }}
        </p>

        <div class="form-actions">
          <button class="btn-danger" type="submit" :disabled="deactivating">
            {{ deactivating ? 'Working…' : 'Yes, deactivate' }}
          </button>
          <button
            class="btn-ghost"
            type="button"
            :disabled="deactivating"
            @click="dangerOpen = false; dangerError = ''; dangerPassword = ''"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
/*
  Same card as the library and the public profile: avatar, identity and actions on one
  row. Only the columns are spaced by the grid; the rows below the identity carry their
  own margins, because one row gap cannot separate them by different amounts.
*/
.profile-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 22px;
  row-gap: 0;
  padding: 26px 28px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  background-color: var(--paper);
}

/* Anchor for the camera button, which sits on the rim of the avatar. */
.profile-avatar {
  position: relative;
  display: block;
}

.avatar-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-full);
  background-color: var(--paper);
  color: var(--ink-2);
  box-shadow: var(--sh-1);
  cursor: pointer;
  transition:
    color var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease),
    transform var(--t-fast) var(--ease);
}

.avatar-edit svg {
  width: 15px;
  height: 15px;
}

.avatar-edit:hover {
  border-color: var(--spotlight-line);
  color: var(--spotlight);
  transform: scale(1.06);
}

.profile-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/*
  Name, badges and the pencil on one line. The row wraps, so a long name pushes the
  badges onto a second line rather than squeezing them.
*/
.profile-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-top: 6px;
}

.profile-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.024em;
  line-height: 1.15;
  text-overflow: ellipsis;
}

/* Never shrinks: the name gives up its width first, a badge is unreadable clipped. */
.profile-badges {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 6px;
}

/*
  A badge states a fact about the account and nothing more, so it is smaller and
  flatter than .chip, which is a control the reader can press elsewhere in the app.
*/
.badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
}

/* Standing in the product: worth the brand colour. */
.badge-brand {
  border-color: var(--spotlight-line);
  background-color: var(--spotlight-soft);
  color: var(--spotlight);
}

/* Plumbing, such as how the account signs in: stated, not advertised. */
.badge-neutral {
  border-color: var(--hairline);
  background-color: var(--canvas);
  color: var(--ink-2);
}

/*
  One labelled fact per line, so the block reads as a small record rather than a run of
  loose grey text. The key column has a fixed width, which is what lines the values up
  under each other whatever the label says - and what keeps the pencils in a column.
*/
.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.meta-key {
  flex: none;
  width: 52px;
  color: var(--ink-3);
}

.meta-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A prompt, not content: it never reads as a real value. */
.meta-value.is-empty {
  color: var(--ink-3);
}

/* A sentence of its own, so it carries no key column and no value column. */
.meta-since {
  margin-top: 2px;
  color: var(--ink-3);
  font-size: 13px;
}

/* The pencil aligns with the first line of the intro, not with its middle. */
.profile-bio-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
}

/* pre-wrap keeps the paragraph breaks the author typed into the intro. */
.profile-bio {
  max-width: 58ch;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.profile-bio.is-empty {
  color: var(--ink-3);
}

.bio-link {
  color: var(--spotlight);
  text-decoration: underline;
  text-decoration-color: var(--spotlight-line);
  text-underline-offset: 2px;
  transition: text-decoration-color var(--t-ui) var(--ease);
}

.bio-link:hover {
  text-decoration-color: var(--spotlight);
}

/*
  The affordance itself: quiet until hovered, because there is one on nearly every row
  and a card of bright buttons would out-shout the content they belong to.
*/
.edit-pen {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: var(--r-full);
  color: var(--ink-3);
  transition:
    color var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease),
    background-color var(--t-ui) var(--ease);
}

.edit-pen svg {
  width: 14px;
  height: 14px;
}

.edit-pen:hover {
  border-color: var(--spotlight-line);
  background-color: var(--spotlight-soft);
  color: var(--spotlight);
}

.edit-pen:focus-visible {
  outline: none;
  border-color: var(--spotlight);
  box-shadow: 0 0 0 3px var(--spotlight-soft);
}

/*
  In-place editors. Each one inherits the type of the line it replaces, so the card
  keeps its shape while a value is being typed: the same size, the same weight, the
  same place. Only a light frame says the text is now live.
*/
.inline-input {
  width: 100%;
  border: 1px solid var(--spotlight-line);
  border-radius: var(--r-md);
  background-color: var(--paper);
  color: var(--ink);
  transition:
    border-color var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease);
}

.inline-input::placeholder {
  color: var(--ink-3);
}

.inline-input:focus {
  outline: none;
  border-color: var(--spotlight);
  box-shadow: 0 0 0 3px var(--spotlight-soft);
}

.inline-name {
  max-width: 460px;
  padding: 2px 12px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.024em;
  line-height: 1.28;
}

.inline-phone {
  max-width: 260px;
  padding: 5px 12px;
  font-size: 13.5px;
  line-height: 1.45;
}

.inline-bio-editor {
  display: block;
  width: 100%;
  max-width: 58ch;
}

.inline-bio {
  display: block;
  min-height: 92px;
  padding: 8px 12px;
  font-size: 15px;
  line-height: 1.55;
  resize: vertical;
}

.inline-count {
  display: block;
  margin-top: 6px;
  color: var(--ink-3);
  font-size: 12.5px;
  text-align: right;
}

/* Errors sit under the row that caused them and appear while typing, not on submit. */
.inline-error {
  margin-top: 6px;
  color: var(--ans-a);
  font-size: 13px;
  line-height: 1.45;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Shared by both panels below, so every form has one rhythm. */
.edit-form {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.form-field {
  display: block;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 500;
}

.form-hint {
  display: block;
  margin-top: 6px;
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.4;
}

.form-error {
  color: var(--ans-a);
  font-size: 13.5px;
  line-height: 1.45;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* The sections under the card: same paper, one step quieter than the profile card. */
.panel {
  margin-top: 16px;
  padding: 22px 24px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

.panel-title {
  color: var(--ink);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.014em;
}

.panel-text {
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.5;
}

/* Compact list rows for the two password actions. */
.password-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  background-color: var(--paper);
  transition:
    background-color var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease);
}

.password-option:hover {
  background-color: var(--canvas);
}

.password-option.is-open {
  border-color: var(--spotlight-line);
  background-color: var(--canvas);
}

.password-option-caret {
  color: var(--ink-3);
  transition: transform var(--t-ui) var(--ease);
}

.password-option.is-open .password-option-caret {
  transform: rotate(90deg);
}

/* Below this width the actions cannot share the row without squeezing the name. */
@media (max-width: 760px) {
  .profile-card {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 22px 20px;
  }

  .profile-actions {
    grid-column: 1 / -1;
    margin-top: 18px;
  }

  .profile-name,
  .inline-name {
    font-size: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .avatar-edit,
  .edit-pen,
  .inline-input,
  .bio-link,
  .password-option,
  .password-option-caret {
    transition: none;
  }

  .avatar-edit:hover {
    transform: none;
  }
}
</style>
