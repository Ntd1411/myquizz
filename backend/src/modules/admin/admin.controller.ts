import type { Response, NextFunction } from 'express'
import { AppError } from '../../shared/errors/AppError.js'
import { success } from '../../shared/utils/response.js'
import type { AuthRequest } from '../auth/auth.type.js'
import * as adminService from './admin.service.js'

export async function getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role != 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN')
    }

    const { offset, limit } = req.query

    const { users, pagination } = await adminService.getAllUsers(Number(offset) || 0, Number(limit) || 20)

    success(res, { users }, 200, { pagination })
  } catch (error) {
    next(error)
  }
}
