import Joi from 'joi'

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'any.required': 'Email is required',
    'string.email': 'Email must be a valid email address'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
})

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required'
  }),
  fullname: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Full name must be at least 2 characters',
    'string.max': 'Full name must not exceed 100 characters',
    'any.required': 'Full name is required'
  }),
  phone: Joi.string()
    .pattern(/^\+?[0-9]{7,15}$/)
    .messages({
      'string.pattern.base':
        'Phone number must be between 7 and 15 digits, and can start with +'
    })
})

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(8).required().messages({
    'string.min': 'Old password must be at least 8 characters',
    'any.required': 'Old password is required'
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters',
    'any.required': 'New password is required'
  })
})

export const updateProfileSchema = Joi.object({
  fullname: Joi.string().min(2).max(100).messages({
    'string.min': 'Full name must be at least 2 characters',
    'string.max': 'Full name must not exceed 100 characters'
  }),
  email: Joi.string().email().messages({
    'string.email': 'Email must be a valid email address'
  }),
  phone: Joi.string()
    .pattern(/^\+?[0-9]{7,15}$/)
    .messages({
      'string.pattern.base':
        'Phone number must be between 7 and 15 digits, and can start with +'
    }),
  description: Joi.string().max(200).messages({
    'string.max': 'Description must not exceed 200 characters'
  })
})

export const deactivateAccountSchema = Joi.object({
  password: Joi.string().min(8).required()
})

export const createQuizSchema = Joi.object()

export const updateQuizSchema = Joi.object()
