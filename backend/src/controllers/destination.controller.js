import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import * as destinationService from '../services/destination.service.js';

export const list = asyncHandler(async (req, res) => {
  const { search, featured, limit, page } = req.query;
  const result = await destinationService.listDestinations({ search, featured, limit, page });
  sendSuccess(res, result.destinations, 200, result.meta);
});

export const detail = asyncHandler(async (req, res) => {
  const result = await destinationService.getDestination(req.params.id);
  sendSuccess(res, result);
});

export default { list, detail };
