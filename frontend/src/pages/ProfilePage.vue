<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
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
import { revealOnEnter } from '@/composables/useMotion'

/**
 * Account settings, wired to the backend user module:
 *   PATCH  /users/me                profile fields
 *   PATCH  /users/me/avatar         avatar URL from /storage/presign
 *   PATCH  /users/me/password       password change (knows the old password)
 *   POST   /users/forgot-password   emailed reset code (forgot the old password)
 *   DELETE /users/me                deactivate (soft delete)
 *
 * Every section is read-only until the user asks to edit it. Showing four open forms
 * at once made the page look like a data-entry screen and made accidental edits easy;
 * now each card shows the current value and swaps to inputs only on demand.
 *
 * Client-side rules mirror updateProfileSchema exactly so a valid form never gets a
 * 400 back: fullname 2-100, valid email, phone 7-15 digits with an optional "+",
 * description at most 200 characters.
 */
const LIMITS = { nameMin: 2, nameMax: 100, descriptionMax: 200, passwordMin: 8 }
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const pageEl = ref(null)

const profile = reactive({ fullname: '', email: '', phone: '', description: '' })
const profileError = ref('')
const savingProfile = ref(false)
const editingProfile = ref(false)

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

// Google accounts have no local password, so both password flows would always fail.
const isGoogleAccount = computed(() => Boolean(auth.user?.googleId || auth.user?.provider === 'google'))

/** Read-only rows rendered when the profile card is not in edit mode. */
const profileRows = computed(() => [
  { label: 'Full name', value: auth.user?.fullname || '' },
  { label: 'Email', value: auth.user?.email || '' },
  { label: 'Phone', value: auth.user?.phone || '' },
  { label: 'About you', value: auth.user?.description || '' },
])

function fillFromStore() {
  profile.fullname = auth.user?.fullname ?? ''
  profile.email = auth.user?.email ?? ''
  profile.phone = auth.user?.phone ?? ''
  profile.description = auth.user?.description ?? ''
}

onMounted(() => {
  fillFromStore()
  revealOnEnter(pageEl.value)
})

// The session probe may land after this page mounts on a hard refresh. Never clobber
// what the user is currently typing.
watch(
  () => auth.user,
  () => {
    if (!editingProfile.value) fillFromStore()
  },
)

/** Only changed fields are sent, so the backend never re-checks an untouched email. */
function buildProfilePatch() {
  const patch = {}
  const fields = ['fullname', 'email', 'phone', 'description']
  for (const field of fields) {
    const next = profile[field].trim()
    const current = auth.user?.[field] ?? ''
    if (next !== current) patch[field] = next
  }
  return patch
}

const hasProfileChanges = computed(() => Object.keys(buildProfilePatch()).length > 0)

function validateProfile(patch) {
  if ('fullname' in patch) {
    if (patch.fullname.length < LIMITS.nameMin) return `Full name must be at least ${LIMITS.nameMin} characters.`
    if (patch.fullname.length > LIMITS.nameMax) return `Full name must be at most ${LIMITS.nameMax} characters.`
  }
  if ('email' in patch && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) {
    return 'Please enter a valid email address.'
  }
  if ('phone' in patch && patch.phone && !PHONE_PATTERN.test(patch.phone)) {
    return 'Phone must be 7 to 15 digits.'
  }
  if ('description' in patch && patch.description.length > LIMITS.descriptionMax) {
    return `About you must be at most ${LIMITS.descriptionMax} characters.`
  }
  return ''
}

function startEditProfile() {
  fillFromStore()
  profileError.value = ''
  editingProfile.value = true
}

function cancelEditProfile() {
  fillFromStore()
  profileError.value = ''
  editingProfile.value = false
}

async function saveProfile() {
  profileError.value = ''
  const patch = buildProfilePatch()
  if (!Object.keys(patch).length) {
    editingProfile.value = false
    return
  }

  const invalid = validateProfile(patch)
  if (invalid) {
    profileError.value = invalid
    return
  }

  savingProfile.value = true
  try {
    const updated = await updateMe(patch)
    auth.setUser(updated)
    editingProfile.value = false
    ui.toast('Your profile has been updated.', 'success')
  } catch (error) {
    // A duplicate email or phone comes back as a plain 400 from the backend.
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
    // 403 means the current password is wrong; 429 comes from the auth rate limiter.
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
  const email = auth.user?.email
  if (!email) return

  sendingReset.value = true
  try {
    const resetTime = await forgotPassword(email)
    ui.toast('We emailed you a reset code.', 'success')
    router.push({ name: 'reset-password', query: { email, resetTime: resetTime ?? undefined } })
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
  <div ref="pageEl" class="container-page max-w-[760px] pb-xxl pt-lg">
    <div data-enter>
      <p class="eyebrow-label">
        Account
      </p>
      <h1 class="mt-xxs text-heading-1 text-ink">
        Edit your profile
      </h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        Your name, avatar and intro are shown on every quiz you publish.
      </p>
    </div>

    <!-- Avatar -->
    <section class="card-surface mt-lg p-lg" data-enter>
      <h2 class="text-title text-ink">
        Avatar
      </h2>
      <div class="mt-md flex items-center gap-md">
        <div class="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-hairline">
          <img
            v-if="auth.avatarUrl"
            :src="auth.avatarUrl"
            :alt="auth.displayName"
            class="h-full w-full object-cover"
          >
          <span v-else class="grid h-full w-full place-items-center bg-primary text-title font-semibold text-white">
            {{ auth.initials }}
          </span>
        </div>

        <div>
          <label class="btn-utility cursor-pointer">
            {{ avatarUploading ? 'Uploading…' : 'Change avatar' }}
            <input
              ref="avatarInput"
              class="hidden"
              type="file"
              accept="image/*"
              :disabled="avatarUploading"
              @change="onAvatarPicked"
            >
          </label>
          <p class="mt-xs text-caption text-ink-faint">
            JPG or PNG, up to 2MB.
          </p>
        </div>
      </div>
    </section>

    <!-- Profile fields: read-only summary until Edit is pressed -->
    <section class="card-surface mt-md p-lg" data-enter>
      <div class="flex items-center justify-between gap-sm">
        <h2 class="text-title text-ink">
          Profile details
        </h2>
        <button v-if="!editingProfile" class="btn-utility" type="button" @click="startEditProfile">
          Edit
        </button>
      </div>

      <dl v-if="!editingProfile" class="mt-md divide-y divide-hairline">
        <div
          v-for="row in profileRows"
          :key="row.label"
          class="grid gap-xxs py-sm sm:grid-cols-[180px_1fr] sm:gap-sm sm:py-xs"
        >
          <dt class="text-body-sm text-ink-muted">
            {{ row.label }}
          </dt>
          <dd class="text-body-sm text-ink" :class="row.value ? '' : 'text-ink-faint'">
            {{ row.value || 'Not set' }}
          </dd>
        </div>
      </dl>

      <form v-else class="mt-md grid gap-md" @submit.prevent="saveProfile">
        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Full name</span>
          <input
            v-model="profile.fullname"
            class="field"
            type="text"
            autocomplete="name"
            :maxlength="LIMITS.nameMax"
            placeholder="Your name"
          >
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Email</span>
          <input
            v-model="profile.email"
            class="field"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
          >
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Phone</span>
          <input
            v-model="profile.phone"
            class="field"
            type="tel"
            autocomplete="tel"
            placeholder="+84901234567"
          >
          <span class="mt-xxs block text-caption text-ink-faint">7 to 15 digits, an optional leading +.</span>
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">About you</span>
          <textarea
            v-model="profile.description"
            class="field min-h-[96px] resize-y"
            :maxlength="LIMITS.descriptionMax"
            placeholder="Introduce yourself: who you are and what you like to quiz about."
          />
          <span class="mt-xxs block text-caption text-ink-faint">
            A short self-introduction shown on your public profile.
            {{ profile.description.length }} / {{ LIMITS.descriptionMax }}
          </span>
        </label>

        <p v-if="profileError" class="text-body-sm text-sticker-orange-deep">
          {{ profileError }}
        </p>

        <div class="flex items-center gap-xs">
          <button class="btn-primary" type="submit" :disabled="savingProfile || !hasProfileChanges">
            {{ savingProfile ? 'Saving…' : 'Save changes' }}
          </button>
          <button class="btn-ghost" type="button" :disabled="savingProfile" @click="cancelEditProfile">
            Cancel
          </button>
        </div>
      </form>
    </section>

    <!-- Password: two entry points, nothing expanded by default -->
    <section class="card-surface mt-md p-lg" data-enter>
      <h2 class="text-title text-ink">
        Password
      </h2>

      <p v-if="isGoogleAccount" class="mt-xs text-body-sm text-ink-muted">
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
          class="mt-md grid gap-md border-t border-hairline pt-md"
          @submit.prevent="savePassword"
        >
          <label class="block">
            <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Current password</span>
            <input
              v-model="passwords.oldPassword"
              class="field"
              type="password"
              autocomplete="current-password"
            >
          </label>

          <label class="block">
            <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">New password</span>
            <input
              v-model="passwords.newPassword"
              class="field"
              type="password"
              autocomplete="new-password"
            >
            <span class="mt-xxs block text-caption text-ink-faint">At least {{ LIMITS.passwordMin }} characters.</span>
          </label>

          <label class="block">
            <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Confirm new password</span>
            <input
              v-model="passwords.confirmPassword"
              class="field"
              type="password"
              autocomplete="new-password"
            >
          </label>

          <p v-if="passwordError" class="text-body-sm text-sticker-orange-deep">
            {{ passwordError }}
          </p>

          <div class="flex items-center gap-xs">
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
          <p class="text-body-sm text-ink-muted">
            We send a 6-digit code to <span class="text-ink">{{ auth.user?.email }}</span>. The next
            screen asks for that code and your new password.
          </p>

          <p v-if="passwordError" class="mt-xs text-body-sm text-sticker-orange-deep">
            {{ passwordError }}
          </p>

          <div class="mt-md flex items-center gap-xs">
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
    <section class="card-surface mt-md p-lg" data-enter>
      <h2 class="text-title text-ink">
        Deactivate account
      </h2>
      <p class="mt-xs text-body-sm text-ink-muted">
        Your quizzes stop being playable and you are signed out everywhere. Support can
        restore the account later.
      </p>

      <button v-if="!dangerOpen" class="btn-utility mt-md" type="button" @click="dangerOpen = true">
        Deactivate my account
      </button>

      <form v-else class="mt-md grid gap-md" @submit.prevent="confirmDeactivate">
        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">
            Confirm with your password
          </span>
          <input
            v-model="dangerPassword"
            class="field"
            type="password"
            autocomplete="current-password"
          >
        </label>

        <p v-if="dangerError" class="text-body-sm text-sticker-orange-deep">
          {{ dangerError }}
        </p>

        <div class="flex items-center gap-xs">
          <button class="btn-utility" type="submit" :disabled="deactivating">
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
  background-color: var(--surface);
  transition:
    background-color 150ms ease,
    border-color 150ms ease;
}

.password-option:hover {
  background-color: var(--canvas-soft);
}

.password-option.is-open {
  border-color: var(--ink-faint);
  background-color: var(--canvas-soft);
}

.password-option-caret {
  color: var(--ink-faint);
  transition: transform 150ms ease;
}

.password-option.is-open .password-option-caret {
  transform: rotate(90deg);
}
</style>
