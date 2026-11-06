import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import * as tripService from '../services/trip.service.js';
import * as itineraryService from '../services/itinerary.service.js';
import * as expenseService from '../services/expense.service.js';
import { createWizardDraft, saveWizardProgress } from '../services/wizard.service.js';

export const list = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const result = await tripService.listTrips(req.user.id, { status, search, page, limit });
  sendSuccess(res, result.trips, 200, result.meta);
});

export const create = asyncHandler(async (req, res) => {
  const trip = await tripService.createTrip(req.user.id, req.body);
  sendSuccess(res, { trip }, 201);
});

export const createDraft = asyncHandler(async (req, res) => {
  const draft = await createWizardDraft(req.user.id, req.body.destination);
  sendSuccess(res, { trip: draft }, 201);
});

export const saveWizard = asyncHandler(async (req, res) => {
  const result = await saveWizardProgress(req.params.id, req.user.id, req.body.state);
  sendSuccess(res, result);
});

export const detail = asyncHandler(async (req, res) => {
  const result = await tripService.getTripDetail(req.params.id, req.user.id);
  sendSuccess(res, result);
});

export const update = asyncHandler(async (req, res) => {
  const trip = await tripService.updateTrip(req.params.id, req.user.id, req.body);
  sendSuccess(res, { trip });
});

export const remove = asyncHandler(async (req, res) => {
  await tripService.deleteTrip(req.params.id, req.user.id);
  sendSuccess(res, { id: req.params.id });
});

export const budget = asyncHandler(async (req, res) => {
  const summary = await tripService.getBudget(req.params.id, req.user.id);
  sendSuccess(res, { budget: summary });
});

export const addDay = asyncHandler(async (req, res) => {
  const trip = await tripService.getOwnedTrip(req.params.id, req.user.id);
  const itinerary = await itineraryService.addDay(trip, req.body);
  sendSuccess(res, { itinerary }, 201);
});

export const addItem = asyncHandler(async (req, res) => {
  const trip = await tripService.getOwnedTrip(req.params.id, req.user.id);
  const result = await itineraryService.addItem(trip, req.body);
  sendSuccess(res, result, 201);
});

export const listExpenses = asyncHandler(async (req, res) => {
  const expenses = await expenseService.listExpenses(req.params.id, req.user.id);
  sendSuccess(res, expenses);
});

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.params.id, req.user.id, req.body);
  sendSuccess(res, { expense }, 201);
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.expenseId, req.user.id, req.body);
  sendSuccess(res, { expense });
});
export const deleteExpense = asyncHandler(async (req, res) => {
  const result = await expenseService.removeExpense(req.params.expenseId, req.user.id);
  sendSuccess(res, result);
});

export default { list, create, createDraft, saveWizard, detail, update, remove, budget, addDay, addItem, listExpenses, createExpense, updateExpense, deleteExpense };
