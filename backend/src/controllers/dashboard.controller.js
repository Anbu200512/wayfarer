import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import { getDashboard } from '../services/dashboard.service.js';

export const overview = asyncHandler(async (req, res) => {
  const result = await getDashboard(req.user.id);
  sendSuccess(res, result);
});

export default { overview };
