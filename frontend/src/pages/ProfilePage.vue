<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { uploadImage } from '@/api/storage.api'
import { updateMe, changePassword, updateAvatar, deactivateAccount } from '@/api/users.api'

/**
 * Account settings, wired to the backend user module:
 *   PATCH  /users/me           profile fields
 *   PATCH  /users/me/avatar    avatar URL from /storage/presign
 *   PATCH  /users/me/password  password change
 *   DELETE /users/me           deactivate (soft delete)
 *
 * Client-side rules mirror updateProfileSchema exactly so a valid form never gets
 * a 400 back: fullname 2-100, valid email, phone 7-15 digits with an optional "+",
 * description at most 200 characters.
 */
const LIMITS = { nameMin: 2, nameMax: 100, descriptionMax: 200, passwordMin: 8 }
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const profile = reactive({ fullname: '', email: '', phone: '', description: '' })
const profileError = ref('')
const savingProfile = ref(false)

const avatarUploading = ref(false)
const avatarInput = ref(null)

const passwords = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref('')
const savingPassword = ref(false)

const dangerOpen = ref(false)
const dangerPassword = ref('')
const dangerError = ref('')
const deactivating = ref(false)

// Google accounts have no local password, so the password card would always fail.
const isGoogleAccount = computed(() => Boolean(auth.user?.googleId || auth.user?.provider === 'google'))

function fillFromStore() {
  profile.fullname = auth.user?.fullname ?? ''
  profile.email = auth.user?.email ?? ''
  profile.phone = auth.user?.phone ?? ''
  profile.description = auth.user?.description ?? ''
}

onMounted(fillFromStore)
// The session probe may land after this page mounts on a hard refresh.
watch(() => auth.user, fillFromStore)

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
    return `About must be at most ${LIMITS.descriptionMax} characters.`
  }
  return ''
}

async function saveProfile() {
  profileError.value = ''
  const patch = buildProfilePatch()
  if (!Object.keys(patch).length) {
    ui.toast('Nothing to save yet.')
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
    ui.toast('Your profile has been updated.', 'success')
  } catch (error) {
    // A duplicate email or phone comes back as a plain 400 from the backend.
    profileError.value = toErrorMessage(error, 'Could not update your profile.')
  } finally {
    savingProfile.value = false
  }
}

function resetProfile() {
  fillFromStore()
  profileError.value = ''
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
  <div class="container-page max-w-[760px] pb-xxl pt-lg">
    <p class="eyebrow-label">Account</p>
    <h1 class="mt-xxs text-heading-1 text-ink">Edit your profile</h1>
    <p class="mt-xs text-body-sm text-ink-muted">
      Your name and avatar are shown on every quiz you publish.
    </p>

    <!-- Avatar -->
    <section class="card-surface mt-lg p-lg">
      <h2 class="text-title text-ink">Avatar</h2>
      <div class="mt-md flex items-center gap-md">
        <div class="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-hairline">
          <img
            v-if="auth.avatarUrl"
            :src="auth.avatarUrl"
            :alt="auth.displayName"
            class="h-full w-full object-cover"
          />
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
            />
          </label>
          <p class="mt-xs text-caption text-ink-faint">JPG or PNG, up to 2MB.</p>
        </div>
      </div>
    </section>

    <!-- Profile fields -->
    <section class="card-surface mt-md p-lg">
      <h2 class="text-title text-ink">Profile details</h2>

      <form class="mt-md grid gap-md" @submit.prevent="saveProfile">
        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Full name</span>
          <input
            v-model="profile.fullname"
            class="field"
            type="text"
            autocomplete="name"
            :maxlength="LIMITS.nameMax"
            placeholder="Your name"
          />
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Email</span>
          <input
            v-model="profile.email"
            class="field"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
          />
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Phone</span>
          <input
            v-model="profile.phone"
            class="field"
            type="tel"
            autocomplete="tel"
            placeholder="+84901234567"
          />
          <span class="mt-xxs block text-caption text-ink-faint">7 to 15 digits, an optional leading +.</span>
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">About</span>
          <textarea
            v-model="profile.description"
            class="field min-h-[96px] resize-y"
            :maxlength="LIMITS.descriptionMax"
            placeholder="A short line about the quizzes you make."
          ></textarea>
          <span class="mt-xxs block text-caption text-ink-faint">
            {{ profile.description.length }} / {{ LIMITS.descriptionMax }}
          </span>
        </label>

        <p v-if="profileError" class="text-body-sm text-sticker-orange-deep">{{ profileError }}</p>

        <div class="flex items-center gap-xs">
          <button class="btn-primary" type="submit" :disabled="savingProfile || !hasProfileChanges">
            {{ savingProfile ? 'Saving…' : 'Save changes' }}
          </button>
          <button
            class="btn-ghost"
            type="button"
            :disabled="savingProfile || !hasProfileChanges"
            @click="resetProfile"
          >
            Discard
          </button>
        </div>
      </form>
    </section>

    <!-- Password -->
    <section class="card-surface mt-md p-lg">
      <h2 class="text-title text-ink">Password</h2>

      <p v-if="isGoogleAccount" class="mt-xs text-body-sm text-ink-muted">
        This account signs in with Google, so it has no password to change.
      </p>

      <form v-else class="mt-md grid gap-md" @submit.prevent="savePassword">
        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Current password</span>
          <input
            v-model="passwords.oldPassword"
            class="field"
            type="password"
            autocomplete="current-password"
          />
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">New password</span>
          <input
            v-model="passwords.newPassword"
            class="field"
            type="password"
            autocomplete="new-password"
          />
          <span class="mt-xxs block text-caption text-ink-faint">At least {{ LIMITS.passwordMin }} characters.</span>
        </label>

        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Confirm new password</span>
          <input
            v-model="passwords.confirmPassword"
            class="field"
            type="password"
            autocomplete="new-password"
          />
        </label>

        <p v-if="passwordError" class="text-body-sm text-sticker-orange-deep">{{ passwordError }}</p>

        <div>
          <button
            class="btn-primary"
            type="submit"
            :disabled="savingPassword || !passwords.oldPassword || !passwords.newPassword"
          >
            {{ savingPassword ? 'Saving…' : 'Change password' }}
          </button>
        </div>
      </form>
    </section>

    <!-- Deactivate -->
    <section class="card-surface mt-md p-lg">
      <h2 class="text-title text-ink">Deactivate account</h2>
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
          />
        </label>

        <p v-if="dangerError" class="text-body-sm text-sticker-orange-deep">{{ dangerError }}</p>

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
