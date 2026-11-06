import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import * as expenseService from '../services/expense.service.js';

export const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.id, req.user.id, req.body);
  sendSuccess(res, { expense });
});

export const remove = asyncHandler(async (req, res) => {
  await expenseService.removeExpense(req.params.id, req.user.id);
  sendSuccess(res, { id: req.params.id });
});

export default { update, remove };
