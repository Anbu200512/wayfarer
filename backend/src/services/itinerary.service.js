import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { itineraryToJson, itemToJson } from '../utils/serialize.js';
import { resolveAttraction, resolveRestaurant } from './place.service.js';

const itemInclude = { attraction: true, restaurant: true };

const dateForDay = (trip, dayNumber) => {
  const base = new Date(trip.travelDate);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + (dayNumber - 1));
  return base;
};

export const getOwnedDay = async (dayId, userId) => {
  const day = await prisma.itinerary.findUnique({
    where: { id: dayId },
    include: { trip: { include: { itineraries: { include: { items: itemInclude } } } } },
  });
  if (!day) throw ApiError.notFound('Itinerary day not found.');
  if (day.trip.userId !== userId) throw ApiError.forbidden('You do not have access to this itinerary.');
  return day;
};

export const getOwnedItem = async (itemId, userId) => {
  const item = await prisma.itineraryItem.findUnique({
    where: { id: itemId },
    include: {
      ...itemInclude,
      itinerary: { include: { trip: true } },
    },
  });
  if (!item) throw ApiError.notFound('Itinerary item not found.');
  if (item.itinerary.trip.userId !== userId) {
    throw ApiError.forbidden('You do not have access to this itinerary item.');
  }
  return item;
};

const ensureDay = async (trip, dayNumber) => {
  const requested = Math.max(1, Number(dayNumber) || 1);
  const existing = await prisma.itinerary.findUnique({
    where: { tripId_dayNumber: { tripId: trip.id, dayNumber: requested } },
  });
  if (existing) return existing;

  const last = await prisma.itinerary.findFirst({
    where: { tripId: trip.id },
    orderBy: { dayNumber: 'desc' },
  });
  const numberToCreate = last ? Math.max(requested, last.dayNumber + 1) : requested;

  return prisma.itinerary.create({
    data: {
      tripId: trip.id,
      dayNumber: numberToCreate,
      date: dateForDay(trip, numberToCreate),
      title: `Day ${numberToCreate}`,
    },
  });
};

export const addDay = async (trip, { dayNumber, date, title } = {}) => {
  const last = await prisma.itinerary.findFirst({
    where: { tripId: trip.id },
    orderBy: { dayNumber: 'desc' },
  });
  const nextNumber = Number(dayNumber) || (last ? last.dayNumber + 1 : 1);

  const duplicate = await prisma.itinerary.findUnique({
    where: { tripId_dayNumber: { tripId: trip.id, dayNumber: nextNumber } },
  });
  if (duplicate) {
    throw ApiError.conflict(`Day ${nextNumber} already exists for this trip.`);
  }

  const created = await prisma.itinerary.create({
    data: {
      tripId: trip.id,
      dayNumber: nextNumber,
      date: date ? new Date(date) : dateForDay(trip, nextNumber),
      title: title || `Day ${nextNumber}`,
    },
    include: { items: { include: itemInclude } },
  });

  return itineraryToJson(created);
};

export const updateDay = async (dayId, userId, { title, date, dayNumber }) => {
  const day = await getOwnedDay(dayId, userId);
  const data = {};
  if (title !== undefined) data.title = title;
  if (date !== undefined) data.date = date ? new Date(date) : null;
  if (dayNumber !== undefined && dayNumber !== day.dayNumber) {
    const duplicate = await prisma.itinerary.findUnique({
      where: { tripId_dayNumber: { tripId: day.tripId, dayNumber } },
    });
    if (duplicate) throw ApiError.conflict(`Day ${dayNumber} already exists for this trip.`);
    data.dayNumber = dayNumber;
  }

  const updated = await prisma.itinerary.update({
    where: { id: dayId },
    data,
    include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
  });
  return itineraryToJson(updated);
};

export const removeDay = async (dayId, userId) => {
  const day = await getOwnedDay(dayId, userId);
  const remaining = await prisma.itinerary.count({ where: { tripId: day.tripId } });
  if (remaining <= 1) {
    throw ApiError.badRequest('A trip must keep at least one itinerary day.');
  }
  await prisma.itinerary.delete({ where: { id: dayId } });
  return { id: dayId };
};

export const reorderDay = async (dayId, userId, itemIds) => {
  const day = await getOwnedDay(dayId, userId);
  const items = await prisma.itineraryItem.findMany({ where: { itineraryId: dayId } });
  const validIds = new Set(items.map((item) => item.id));

  for (const id of itemIds) {
    if (!validIds.has(id)) {
      throw ApiError.badRequest('All item ids must belong to this itinerary day.');
    }
  }

  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.itineraryItem.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  const refreshed = await prisma.itinerary.findUnique({
    where: { id: dayId },
    include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
  });
  return itineraryToJson(refreshed);
};

export const addItem = async (trip, payload) => {
  const { dayNumber, type, place, destinationId, attractionId, restaurantId, ...fields } = payload;

  const day = await ensureDay(trip, dayNumber);
  const lastItem = await prisma.itineraryItem.findFirst({
    where: { itineraryId: day.id },
    orderBy: { sortOrder: 'desc' },
  });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  let linkedAttractionId = attractionId ?? null;
  let linkedRestaurantId = restaurantId ?? null;

  if (type === 'ATTRACTION' && !linkedAttractionId && place && fields.lat != null && fields.lng != null) {
    const record = await resolveAttraction(
      { ...place, name: place.name || fields.title, lat: fields.lat, lng: fields.lng },
      destinationId ?? trip.destinationId,
    );
    linkedAttractionId = record.id;
  }

  if (type === 'RESTAURANT' && !linkedRestaurantId && place && fields.lat != null && fields.lng != null) {
    const record = await resolveRestaurant(
      { ...place, name: place.name || fields.title, lat: fields.lat, lng: fields.lng },
      destinationId ?? trip.destinationId,
    );
    linkedRestaurantId = record.id;
  }

  const item = await prisma.itineraryItem.create({
    data: {
      itineraryId: day.id,
      type,
      title: fields.title,
      description: fields.description ?? null,
      note: fields.note ?? null,
      lat: fields.lat ?? null,
      lng: fields.lng ?? null,
      durationMinutes: fields.durationMinutes,
      estimatedCost: fields.estimatedCost,
      sortOrder,
      attractionId: linkedAttractionId,
      restaurantId: linkedRestaurantId,
    },
    include: itemInclude,
  });

  const dayWithItems = await prisma.itinerary.findUnique({
    where: { id: day.id },
    include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
  });

  return { item: itemToJson(item), itinerary: itineraryToJson(dayWithItems) };
};

export const updateItem = async (itemId, userId, payload) => {
  const item = await getOwnedItem(itemId, userId);
  const data = {};

  const simpleFields = ['title', 'durationMinutes', 'estimatedCost', 'note', 'description', 'type', 'sortOrder'];
  for (const field of simpleFields) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }

  let targetDayId = item.itineraryId;
  if (payload.dayNumber !== undefined && payload.dayNumber !== item.itinerary.dayNumber) {
    const trip = await prisma.trip.findUnique({ where: { id: item.itinerary.tripId } });
    const targetDay = await ensureDay(trip, payload.dayNumber);
    const lastItem = await prisma.itineraryItem.findFirst({
      where: { itineraryId: targetDay.id },
      orderBy: { sortOrder: 'desc' },
    });
    data.itineraryId = targetDay.id;
    data.sortOrder = payload.sortOrder ?? (lastItem?.sortOrder ?? -1) + 1;
    targetDayId = targetDay.id;
  }

  await prisma.itineraryItem.update({ where: { id: itemId }, data });

  const sourceDay = await prisma.itinerary.findUnique({
    where: { id: item.itineraryId },
    include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
  });
  const targetDay =
    targetDayId === item.itineraryId
      ? sourceDay
      : await prisma.itinerary.findUnique({
          where: { id: targetDayId },
          include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
        });

  const updated = await prisma.itineraryItem.findUnique({
    where: { id: itemId },
    include: itemInclude,
  });

  return {
    item: itemToJson(updated),
    itinerary: itineraryToJson(targetDay),
    previousItinerary: sourceDay && targetDayId !== item.itineraryId ? itineraryToJson(sourceDay) : undefined,
  };
};

export const removeItem = async (itemId, userId) => {
  const item = await getOwnedItem(itemId, userId);
  await prisma.itineraryItem.delete({ where: { id: itemId } });

  const day = await prisma.itinerary.findUnique({
    where: { id: item.itineraryId },
    include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
  });

  return { id: itemId, itinerary: day ? itineraryToJson(day) : null };
};

export default { addDay, updateDay, removeDay, reorderDay, addItem, updateItem, removeItem, getOwnedDay, getOwnedItem };
