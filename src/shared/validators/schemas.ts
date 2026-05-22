import Joi from 'joi'

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'any.required': 'Vui lòng nhập email',
    'string.email': 'Email phải đúng định dạng'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password phải ít nhất 6 ký tự',
    'any.required': 'Vui lòng nhập password'
  })
})

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email phải đúng định dạng',
    'any.required': 'Vui lòng nhập email'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password phải ít nhất 8 ký tự',
    'any.required': 'Vui lòng nhập password'
  }),
  fullname: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Họ và tên phải ít nhất 2 ký tự',
    'string.max': 'Họ và tên không được vượt quá 100 ký tự',
    'any.required': 'Vui lòng nhập họ và tên'
  }),
  phone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).messages({
    'string.pattern.base': 'Số điện thoại không hợp lệ'
  })
})
