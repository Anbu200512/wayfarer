import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { expenseToJson } from '../utils/serialize.js';
import { getOwnedTrip } from './trip.service.js';

export const listExpenses = async (tripId, userId) => {
  const trip = await getOwnedTrip(tripId, userId);
  return { expenses: (trip.expenses || []).map(expenseToJson), budget: trip.budget };
};

export const createExpense = async (tripId, userId, payload) => {
  await getOwnedTrip(tripId, userId);
  const expense = await prisma.expense.create({
    data: {
      tripId,
      category: payload.category,
      amount: payload.amount,
      description: payload.description,
      spentAt: new Date(payload.spentAt),
    },
  });
  return expenseToJson(expense);
};

const getOwnedExpense = async (expenseId, userId) => {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { trip: { select: { id: true, userId: true } } },
  });
  if (!expense) throw ApiError.notFound('Expense not found.');
  if (expense.trip.userId !== userId) throw ApiError.forbidden('You do not have access to this expense.');
  return expense;
};

export const updateExpense = async (expenseId, userId, payload) => {
  const expense = await getOwnedExpense(expenseId, userId);
  const data = {};
  if (payload.category !== undefined) data.category = payload.category;
  if (payload.amount !== undefined) data.amount = payload.amount;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.spentAt !== undefined) data.spentAt = new Date(payload.spentAt);

  const updated = await prisma.expense.update({ where: { id: expense.id }, data });
  return expenseToJson(updated);
};

export const removeExpense = async (expenseId, userId) => {
  const expense = await getOwnedExpense(expenseId, userId);
  await prisma.expense.delete({ where: { id: expense.id } });
  return { id: expenseId };
};

export default { listExpenses, createExpense, updateExpense, removeExpense };
