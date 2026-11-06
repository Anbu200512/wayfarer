import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import * as userService from '../services/user.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateProfile(req.user.id, {});
  sendSuccess(res, result);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateProfile(req.user.id, req.body);
  sendSuccess(res, result);
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await userService.changePassword(req.user.id, req.body);
  sendSuccess(res, result);
});

export default { getProfile, updateProfile, changePassword };
