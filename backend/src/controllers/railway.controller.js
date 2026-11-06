import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import ApiError from '../utils/ApiError.js';
import { getOwnedTrip } from '../services/trip.service.js';
import { getTrainRunningStatus } from '../services/railway.service.js';

export const runningStatus = asyncHandler(async (req, res) => {
  const trip = await getOwnedTrip(req.params.id, req.user.id);
  let wizard;
  try { wizard = JSON.parse(trip.notes || 'null'); } catch { wizard = null; }
  if (wizard?.wizardVersion !== 1 || wizard.stage < 5 || wizard.mode !== 'TRAIN') {
    throw ApiError.badRequest('Select Train in the transportation stage before requesting train status.', [{ field: 'transportation', message: 'Train status is available only for a saved Train journey.' }]);
  }
  const status = await getTrainRunningStatus(req.params.trainNumber);
  sendSuccess(res, status);
});

export default { runningStatus };
