import type { Response, NextFunction } from 'express'
import type { AuthRequest, User } from '../../shared/types/shared.types.js'
import {
  changePasswordService,
  deactivateAccountService,
  forgotPasswordService,
  getUserService,
  resetPasswordService,
  resetPasswordWithTokenService,
  updateProfileService,
  uploadAvatarService
} from './user.services.js'
import { AppError } from '../../shared/errors/AppError.js'

export function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { password: _pw, deleted_at: _da, ...userWithoutPassword } = req.user as User

    res.json(userWithoutPassword)
  } catch (error) {
    next(error)
  }
}

export async function getUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = Number(req.params.userId)

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(400, 'Invalid user ID')
    }

    const user = await getUserService(userId)

    const userData = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      avatar: user.avatar,
      description: user.description
    }

    res.json(userData)
  } catch (error) {
    next(error)
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as User
    const { oldPassword, newPassword } = req.body as {
      oldPassword?: string
      newPassword?: string
    }

    if (!oldPassword || !newPassword) {
      throw new AppError(400, 'Old password and new password are required')
    }

    await changePasswordService(user, oldPassword, newPassword)

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    next(error)
  }
}

export async function uploadAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { fileUrl } = req.body as { fileUrl?: string }
    if (!fileUrl) {
      throw new AppError(400, 'No file uploaded')
    }

    await uploadAvatarService(req.user?.id as number, fileUrl)

    res.json({ message: 'Avatar uploaded successfully', fileUrl })
  } catch (error) {
    next(error)
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number
    const { fullname, email, phone, description } = req.body as {
      fullname?: string
      email?: string
      phone?: string
      description?: string
    }

    await updateProfileService(userId, fullname, email, phone, description)

    res.json({ message: 'Profile updated successfully' })
  } catch (error) {
    next(error)
  }
}

export async function deactivateAccount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as User
    const { password } = req.body as { password?: string }

    if (!password) {
      throw new AppError(400, 'Password is required to deactivate account')
    }

    await deactivateAccountService(user, password)

    res.json({ message: 'Account deactivated successfully' })
  } catch (error) {
    next(error)
  }
}

export async function forgotPassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body as { email?: string }

    if (!email) {
      throw new AppError(400, 'Email is required')
    }

    await forgotPasswordService(email)

    res.json({ message: 'OTP sent to your email' })
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, otp, newPassword } = req.body as {
      email?: string
      otp?: string
      newPassword?: string
    }

    if (!email || !otp || !newPassword) {
      throw new AppError(400, 'Email, OTP and new password are required')
    }

    await resetPasswordService(email, otp, newPassword)

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    next(error)
  }
}

export async function resetPasswordWithToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { token, newPassword } = req.body as {
      token?: string
      newPassword?: string
    }

    if (!token || !newPassword) {
      throw new AppError(400, 'Token and new password are required')
    }

    await resetPasswordWithTokenService(token, newPassword)

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    next(error)
  }
}
