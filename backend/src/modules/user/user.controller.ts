import type { Response, NextFunction } from 'express'
import {
  changePasswordService,
  completeResetService,
  deactivateAccountService,
  forgotPasswordService,
  getUserService,
  readResetTicketService,
  updateProfileService,
  uploadAvatarService,
  verifyResetService
} from './user.service.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { AuthRequest, User } from '../auth/auth.type.js'
import type { VerifyResetRequest } from './user.schema.js'
import { success } from '../../shared/utils/response.js'

export function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { password: _pw, deleted_at: _da, ...userWithoutPassword } = req.user as User

    return success(res, { user: userWithoutPassword })
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

    // Public shape of an account, built by hand so a new column never leaks by
    // accident. role and created_at belong to it: a profile header states when the
    // account joined, and a staff role is a public fact about who is answering.
    // phone, google_id, auth_provider, password and deleted_at stay private.
    const userData = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      avatar: user.avatar,
      description: user.description,
      role: user.role,
      created_at: user.created_at
    }

    return success(res, { user: userData })
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

    return success(res, { message: 'Password changed successfully' })
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

    const avatarUrl = await uploadAvatarService(req.user?.id as number, fileUrl)

    return success(res, { avatarUrl })
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

    const { fullname, phone, description } = req.body as {
      fullname?: string
      phone?: string
      description?: string
    }

    const { password: _password, deleted_at: _deleted_at, ...updatedUser } =
      await updateProfileService(userId, fullname, phone, description)

    return success(res, { user: updatedUser })
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

    return success(res, { message: 'Account deactivated successfully' })
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

    const { resetTime, expiresAt } = await forgotPasswordService(email)

    return success(res, { resetTime, expiresAt })
  } catch (error) {
    next(error)
  }
}

export async function verifyReset(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // The body came through validateBody(verifyResetSchema), so it is already
    // one of the two accepted shapes: email + otp, or token on its own.
    const result = await verifyResetService(req.body as VerifyResetRequest)

    return success(res, result)
  } catch (error) {
    next(error)
  }
}

export async function getResetTicket(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { ticket } = req.query as { ticket?: string }

    if (!ticket) {
      throw new AppError(400, 'Ticket is required')
    }

    const result = await readResetTicketService(ticket)

    return success(res, result)
  } catch (error) {
    next(error)
  }
}

export async function completeReset(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { ticket, newPassword } = req.body as {
      ticket?: string
      newPassword?: string
    }

    if (!ticket || !newPassword) {
      throw new AppError(400, 'Ticket and new password are required')
    }

    await completeResetService(ticket, newPassword)

    return success(res, { message: 'Password reset successfully' })
  } catch (error) {
    next(error)
  }
}
