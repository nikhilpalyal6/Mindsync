import { Router } from 'express';
import AuthController from '../../controllers/auth.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadSingle } from '../../config/multer.js';
import {
  nameValidator,
  usernameValidator,
  emailValidator,
  passwordValidator,
  bioValidator,
  tokenValidator,
  loginIdentifierValidator,
} from '../../validators/common.validators.js';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware.js';

const router = Router();

router.use(authRateLimiter);

router.post(
  '/register',
  validate([nameValidator(), usernameValidator(), emailValidator(), passwordValidator()]),
  AuthController.register
);

router.post(
  '/login',
  validate([loginIdentifierValidator(), passwordValidator()]),
  AuthController.login
);

router.post(
  '/refresh-token',
  AuthController.refreshToken
);

router.post(
  '/forgot-password',
  validate([emailValidator()]),
  AuthController.forgotPassword
);

router.post(
  '/reset-password',
  validate([tokenValidator(), passwordValidator('newPassword')]),
  AuthController.resetPassword
);

router.post(
  '/verify-email',
  validate([tokenValidator()]),
  AuthController.verifyEmail
);

router.post(
  '/google',
  AuthController.googleAuth
);

router.post(
  '/apple',
  AuthController.appleAuth
);

router.use(protect);

router.post(
  '/logout',
  AuthController.logout
);

router.get(
  '/me',
  AuthController.getCurrentUser
);

router.post(
  '/change-password',
  validate([passwordValidator('currentPassword'), passwordValidator('newPassword')]),
  AuthController.changePassword
);

router.post(
  '/resend-verification',
  AuthController.resendVerificationEmail
);

router.patch(
  '/profile',
  uploadSingle('profileImage'),
  validate([
    nameValidator().optional(),
    usernameValidator().optional(),
    bioValidator(),
  ]),
  AuthController.updateProfile
);

router.delete(
  '/account',
  AuthController.softDeleteAccount
);

export default router;

