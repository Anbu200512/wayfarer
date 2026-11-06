import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import slugify from '../utils/slug.js';
import { destinationToJson, expenseToJson, itineraryToJson, tripToJson } from '../utils/serialize.js';
import { computeBudget } from './budget.service.js';
import { geocode } from './osm.service.js';

export const tripInclude = {
  destination: true,
  itineraries: {
    orderBy: { dayNumber: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: { attraction: true, restaurant: true },
      },
    },
  },
  expenses: { orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }] },
};

const listInclude = {
  itineraries: { select: { _count: { select: { items: true } } } },
  _count: { select: { itineraries: true, expenses: true } },
};

const decorateListItem = (trip) => {
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
};

export const getOwnedTrip = async (tripId, userId) => {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
  if (!trip) throw ApiError.notFound('Trip not found.');
  if (trip.userId !== userId) throw ApiError.forbidden('You do not have access to this trip.');
  return trip;
};

const matchDestination = async (name) => {
  const normalized = String(name || '').trim();
  if (!normalized) return null;
  return prisma.destination.findFirst({
    where: {
      OR: [
        { name: { equals: normalized, mode: 'insensitive' } },
        { slug: slugify(normalized) },
      ],
    },
  });
};

export const listTrips = async (userId, { status, search, page = 1, limit = 12 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const where = { userId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { destinationName: { contains: search, mode: 'insensitive' } },
      { startLocation: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  return {
    trips: trips.map(decorateListItem),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

export const createTrip = async (userId, payload) => {
  const destination = payload.destinationId
    ? await prisma.destination.findUnique({ where: { id: payload.destinationId } })
    : await matchDestination(payload.destinationName);

  let lat = payload.lat ?? destination?.lat ?? null;
  let lng = payload.lng ?? destination?.lng ?? null;

  if ((lat === null || lng === null) && !destination) {
    try {
      const results = await geocode(payload.destinationName, { limit: 1 });
      if (results[0]) {
        lat = results[0].lat;
        lng = results[0].lng;
      }
    } catch {
      // Geocoding is best effort; the trip is still created without coordinates.
    }
  }

  let startLat = payload.startLat ?? null;
  let startLng = payload.startLng ?? null;
  if (startLat === null || startLng === null) {
    try {
      const [start] = await geocode(payload.startLocation, { limit: 1 });
      if (start) { startLat = start.lat; startLng = start.lng; }
    } catch { /* Start coordinates are optional; never substitute destination coordinates. */ }
  }

  const travelDate = new Date(payload.travelDate);

  const trip = await prisma.trip.create({
    data: {
      title: payload.title?.trim() || `Trip to ${payload.destinationName}`,
      destinationName: payload.destinationName,
      startLocation: payload.startLocation,
      travelDate,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      travellers: payload.travellers,
      budget: payload.budgetType === 'PER_PERSON' ? payload.budget * payload.travellers : payload.budget,
      budgetType: payload.budgetType ?? 'TOTAL',
      currency: payload.currency ?? 'USD',
      availableTimeHours: payload.availableTimeHours,
      foodPreference: payload.foodPreference,
      interests: payload.interests,
      mood: payload.moodPreferences?.[0] ?? payload.mood ?? null,
      moodPreferences: payload.moodPreferences?.length ? payload.moodPreferences : (payload.mood ? [payload.mood] : []),
      transportationPreferences: payload.transportationPreferences ?? [],
      cuisinePreferences: payload.cuisinePreferences ?? [],
      foodBudgetMin: payload.foodBudgetMin ?? null,
      foodBudgetMax: payload.foodBudgetMax ?? null,
      status: payload.status,
      notes: payload.notes ?? null,
      lat,
      lng,
      startLat,
      startLng,
      destinationId: destination?.id ?? null,
      userId,
      itineraries: {
        create: { dayNumber: 1, date: travelDate, title: 'Day 1' },
      },
    },
  });

  return getOwnedTrip(trip.id, userId);
};

export const updateTrip = async (tripId, userId, payload) => {
  const existing = await getOwnedTrip(tripId, userId);
  let isGuidedDraft = false;
  try { isGuidedDraft = JSON.parse(existing.notes || 'null')?.wizardVersion === 1; } catch { /* Existing free-form notes are not wizard state. */ }
  const dependencyFields = ['destinationName','startLocation','travelDate','endDate','travellers','budget','availableTimeHours','foodPreference','interests','mood','moodPreferences','transportationPreferences','budgetType','currency','cuisinePreferences','foodBudgetMin','foodBudgetMax','notes','lat','lng','startLat','startLng','destinationId'];
  if (isGuidedDraft && dependencyFields.some((field) => payload[field] !== undefined)) {
    throw ApiError.badRequest('Guided trip details must be changed through the planner stages so dependent selections can be invalidated.', [{ field: 'wizard', message: 'Use the guided planner to update this trip.' }]);
  }

  const data = {};
  const fields = [
    'title',
    'destinationName',
    'startLocation',
    'travelDate',
    'endDate',
    'travellers',
    'budget',
    'availableTimeHours',
    'foodPreference',
    'interests',
    'mood',
    'moodPreferences',
    'transportationPreferences',
    'budgetType',
    'currency',
    'cuisinePreferences',
    'foodBudgetMin',
    'foodBudgetMax',
    'status',
    'notes',
    'lat',
    'lng',
    'startLat',
    'startLng',
    'destinationId',
  ];
  for (const field of fields) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }
  if (payload.travelDate !== undefined) data.travelDate = new Date(payload.travelDate);
  if (payload.endDate !== undefined) {
    data.endDate = payload.endDate ? new Date(payload.endDate) : null;
  }
  if (payload.budget !== undefined) {
    const travellers = payload.travellers ?? existing.travellers;
    const budgetType = payload.budgetType ?? existing.budgetType;
    data.budget = budgetType === 'PER_PERSON' ? payload.budget * travellers : payload.budget;
  }

  const destinationNameChanged =
    payload.destinationName && payload.destinationName !== existing.destinationName;
  if (destinationNameChanged && payload.destinationId === undefined) {
    const destination = await matchDestination(payload.destinationName);
    data.destinationId = destination?.id ?? null;
    if (destination && payload.lat === undefined && payload.lng === undefined) {
      data.lat = destination.lat;
      data.lng = destination.lng;
    }
  }

  await prisma.trip.update({ where: { id: tripId }, data });
  return getOwnedTrip(tripId, userId);
};

export const deleteTrip = async (tripId, userId) => {
  await getOwnedTrip(tripId, userId);
  await prisma.trip.delete({ where: { id: tripId } });
  return { id: tripId };
};

export const getTripDetail = async (tripId, userId) => {
  const trip = await getOwnedTrip(tripId, userId);
  return {
    trip: tripToJson(trip),
    itinerary: trip.itineraries.map(itineraryToJson),
    expenses: (trip.expenses || []).map(expenseToJson),
    budget: computeBudget(trip),
    destination: trip.destination ? destinationToJson(trip.destination) : null,
  };
};

export const getBudget = async (tripId, userId) => {
  const trip = await getOwnedTrip(tripId, userId);
  return computeBudget(trip);
};

export default {
  listTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  getTripDetail,
  getBudget,
  getOwnedTrip,
};
