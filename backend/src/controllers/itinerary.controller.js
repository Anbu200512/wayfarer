import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import * as itineraryService from '../services/itinerary.service.js';

export const updateDay = asyncHandler(async (req, res) => {
  const itinerary = await itineraryService.updateDay(req.params.id, req.user.id, req.body);
  sendSuccess(res, { itinerary });
});

export const removeDay = asyncHandler(async (req, res) => {
  await itineraryService.removeDay(req.params.id, req.user.id);
  sendSuccess(res, { id: req.params.id });
});

export const reorder = asyncHandler(async (req, res) => {
  const itinerary = await itineraryService.reorderDay(req.params.id, req.user.id, req.body.itemIds);
  sendSuccess(res, { itinerary });
});

export const updateItem = asyncHandler(async (req, res) => {
  const result = await itineraryService.updateItem(req.params.id, req.user.id, req.body);
  sendSuccess(res, result);
});

export const removeItem = asyncHandler(async (req, res) => {
  const result = await itineraryService.removeItem(req.params.id, req.user.id);
  sendSuccess(res, result);
});

export default { updateDay, removeDay, reorder, updateItem, removeItem };
