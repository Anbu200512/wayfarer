import prisma from '../config/prisma.js';
import { tripToJson } from '../utils/serialize.js';
import { popularDestinations } from './destination.service.js';

export const getDashboard = async (userId) => {
  const now = new Date();

  const [totalTrips, upcomingTrips, completedTrips, planningTrips, destinationCount, budgetAgg, itemAgg, recentRows] =
    await Promise.all([
      prisma.trip.count({ where: { userId } }),
      prisma.trip.count({
        where: { userId, travelDate: { gte: now }, status: { in: ['PLANNING', 'CONFIRMED'] } },
      }),
      prisma.trip.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.trip.count({ where: { userId, status: 'PLANNING' } }),
      prisma.trip.findMany({ where: { userId }, distinct: ['destinationName'], select: { destinationName: true } }),
      prisma.trip.aggregate({ where: { userId }, _sum: { budget: true } }),
      prisma.itineraryItem.count({ where: { itinerary: { trip: { userId } } } }),
      prisma.trip.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { itineraries: true, expenses: true } },
          itineraries: { select: { _count: { select: { items: true } } } },
        },
      }),
    ]);

  const recentTrips = recentRows.map((trip) => {
    const itemCount = (trip.itineraries || []).reduce(
      (sum, day) => sum + (day._count?.items ?? 0),
      0,
    );
    const json = tripToJson(trip);
    delete json.itineraries;
    return {
      ...json,
      dayCount: trip._count?.itineraries ?? 0,
      itemCount,
      expenseCount: trip._count?.expenses ?? 0,
    };
  });

  return {
    stats: {
      totalTrips,
      upcomingTrips,
      completedTrips,
      planningTrips,
      destinations: destinationCount.length,
      totalBudget: Number(budgetAgg._sum?.budget ?? 0),
      plannedItems: itemAgg,
    },
    recentTrips,
    popularDestinations: await popularDestinations(6),
  };
};

export default getDashboard;
