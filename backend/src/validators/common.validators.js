import { body, param, query } from 'express-validator';

export const emailValidator = (field = 'email') =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail();

export const passwordValidator = (field = 'password') =>
  body(field)
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character');

export const usernameValidator = (field = 'username') =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Username can only contain lowercase letters, numbers, and underscores')
    .toLowerCase();

export const nameValidator = (field = 'name') =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes');

export const objectIdValidator = (paramName = 'id') =>
  param(paramName)
    .notEmpty()
    .withMessage(`${paramName} is required`)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`);

export const paginationValidator = () => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

export const bioValidator = (field = 'bio') =>
  body(field)
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters');

export const tokenValidator = (field = 'token') =>
  body(field)
    .notEmpty()
    .withMessage('Token is required')
    .isString()
    .withMessage('Token must be a string');
