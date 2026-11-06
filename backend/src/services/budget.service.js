const money = (value) => Number(value || 0);

const CATEGORY_LABELS = {
  TRANSPORT: 'Transportation',
  FOOD: 'Food',
  ATTRACTION: 'Tickets & attractions',
  ACCOMMODATION: 'Accommodation',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
};

/**
 * Computes a budget summary from a trip with its itinerary items and recorded expenses.
 */
export const computeBudget = (trip) => {
  const items = (trip.itineraries || []).flatMap((day) => day.items || []);

  const estimated = { TRANSPORT: 0, FOOD: 0, ATTRACTION: 0, ACCOMMODATION: 0, SHOPPING: 0, OTHER: 0 };
  for (const item of items) {
    const cost = money(item.estimatedCost);
    switch (item.type) {
      case 'TRANSPORT':
        estimated.TRANSPORT += cost;
        break;
      case 'RESTAURANT':
        estimated.FOOD += cost;
        break;
      case 'ATTRACTION':
        estimated.ATTRACTION += cost;
        break;
      case 'ACCOMMODATION':
        estimated.ACCOMMODATION += cost;
        break;
      default:
        estimated.OTHER += cost;
    }
  }

  const spent = { TRANSPORT: 0, FOOD: 0, ATTRACTION: 0, ACCOMMODATION: 0, SHOPPING: 0, OTHER: 0 };
  for (const expense of trip.expenses || []) {
    const category = expense.category in spent ? expense.category : 'OTHER';
    spent[category] += money(expense.amount);
  }

  const spentGrouped = {
    TRANSPORT: spent.TRANSPORT,
    FOOD: spent.FOOD,
    ATTRACTION: spent.ATTRACTION,
    ACCOMMODATION: spent.ACCOMMODATION,
    SHOPPING: spent.SHOPPING,
    OTHER: spent.OTHER,
  };

  const round = (value) => Math.round(value * 100) / 100;

  const categories = Object.keys(estimated).map((key) => {
    const categoryEstimated = estimated[key];
    const categorySpent = spentGrouped[key];
    return {
      key,
      label: CATEGORY_LABELS[key],
      estimated: round(categoryEstimated),
      spent: round(categorySpent),
      total: round(categoryEstimated + categorySpent),
    };
  });

  const totalBudget = round(money(trip.budget));
  const totalEstimated = round(categories.reduce((sum, c) => sum + c.estimated, 0));
  const totalSpent = round(categories.reduce((sum, c) => sum + c.spent, 0));
  const totalCommitted = round(totalEstimated + totalSpent);
  const remaining = round(totalBudget - totalCommitted);

  const plannedMinutes = items.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
  const availableMinutes = (trip.availableTimeHours || 0) * 60;

  return {
    totalBudget,
    totalEstimated,
    totalSpent,
    totalCommitted,
    remaining,
    percentUsed: totalBudget > 0 ? Math.round((totalCommitted / totalBudget) * 100) : 0,
    isOverBudget: remaining < 0,
    categories,
    plannedMinutes,
    plannedHours: round(plannedMinutes / 60),
    availableMinutes,
    availableHours: trip.availableTimeHours || 0,
    timeUtilizationPercent:
      availableMinutes > 0 ? Math.round((plannedMinutes / availableMinutes) * 100) : 0,
    itemCount: items.length,
    expenseCount: (trip.expenses || []).length,
  };
};

export default computeBudget;
