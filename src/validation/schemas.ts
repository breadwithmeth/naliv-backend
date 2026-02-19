import Joi from 'joi';

export const authSchemas = {
  register: Joi.object({
    phone: Joi.string().pattern(/^\+?7\d{10}$/).required().messages({
      'string.pattern.base': 'phone должен быть в формате +7XXXXXXXXXX'
    }),
    password: Joi.string().min(8).max(128).required(),
    name: Joi.string().max(255).allow('', null),
    first_name: Joi.string().max(255).allow('', null),
    last_name: Joi.string().max(255).allow('', null)
  }),

  login: Joi.object({
    phone: Joi.string().pattern(/^\+?7\d{10}$/).required(),
    password: Joi.string().required()
  }),

  sendCode: Joi.object({
    phone_number: Joi.string().pattern(/^\+?7\d{10}$/).required()
  }),

  verifyCode: Joi.object({
    phone_number: Joi.string().pattern(/^\+?7\d{10}$/).required(),
    onetime_code: Joi.string().min(4).max(6).required()
  }),

  refresh: Joi.object({
    session_token: Joi.string().min(10).required()
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(8).max(128).required()
  })
};

export const paymentSchemas = {
  addCardInit: Joi.object({
    backLink: Joi.string().uri().required(),
    failureBackLink: Joi.string().uri().required(),
    postLink: Joi.string().uri().required(),
    description: Joi.string().max(255).optional(),
    language: Joi.string().max(5).optional()
  }),

  status: Joi.object({
    invoiceId: Joi.string().max(100).required(),
    error: Joi.string().max(255).optional(),
    errorMessage: Joi.string().max(255).optional()
  }),

  testInvoiceGeneration: Joi.object({
    userId: Joi.number().integer().min(1).optional(),
    count: Joi.number().integer().min(1).max(100).optional()
  }),

  testInit: Joi.object({
    userId: Joi.number().integer().min(1).optional(),
    amount: Joi.number().precision(2).min(0).optional(),
    invoiceId: Joi.string().max(100).optional(),
    backLink: Joi.string().uri().optional(),
    failureBackLink: Joi.string().uri().optional(),
    postLink: Joi.string().uri().optional(),
    description: Joi.string().max(255).optional(),
    language: Joi.string().max(5).optional()
  })
};
