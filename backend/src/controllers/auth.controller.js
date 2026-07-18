import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import AuthService from '../services/auth.service.js';
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromRequest } from '../utils/cookie.utils.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AuthController {
  static register = asyncHandler(async (req, res) => {
    const { name, username, email, password } = req.body;
    const result = await AuthService.register({ name, username, email, password });

    res.status(HTTP_STATUS.CREATED).json(
      new ApiResponse(HTTP_STATUS.CREATED, result, 'User registered successfully')
    );
  });

  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, tokens } = await AuthService.login(email, password);

    setAuthCookies(res, tokens);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, { user, accessToken: tokens.accessToken }, 'Login successful')
    );
  });

  static logout = asyncHandler(async (req, res) => {
    await AuthService.logout(req.user._id);
    clearAuthCookies(res);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Logout successful')
    );
  });

  static refreshToken = asyncHandler(async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    const tokens = await AuthService.refreshAccessToken(refreshToken);

    setAuthCookies(res, tokens);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, { accessToken: tokens.accessToken }, 'Token refreshed successfully')
    );
  });

  static getCurrentUser = asyncHandler(async (req, res) => {
    const user = await AuthService.getCurrentUser(req.user._id);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, user, 'User retrieved successfully')
    );
  });

  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user._id, currentPassword, newPassword);
    clearAuthCookies(res);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Password changed successfully')
    );
  });

  static forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, result, result.message)
    );
  });

  static resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    await AuthService.resetPassword(token, newPassword);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Password reset successfully')
    );
  });

  static verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.body;
    await AuthService.verifyEmail(token);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Email verified successfully')
    );
  });

  static resendVerificationEmail = asyncHandler(async (req, res) => {
    await AuthService.resendVerificationEmail(req.user._id);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Verification email resent successfully')
    );
  });

  static updateProfile = asyncHandler(async (req, res) => {
    const updateData = req.body;
    const user = await AuthService.updateProfile(req.user._id, updateData);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, user, 'Profile updated successfully')
    );
  });

  static softDeleteAccount = asyncHandler(async (req, res) => {
    await AuthService.softDeleteAccount(req.user._id);
    clearAuthCookies(res);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Account deleted successfully')
    );
  });
}

export default AuthController;
