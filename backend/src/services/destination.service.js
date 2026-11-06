import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { attractionToJson, destinationToJson, restaurantToJson } from '../utils/serialize.js';

export const listDestinations = async ({ search, featured, limit = 24, page = 1 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 60);
  const safePage = Math.max(1, Number(page) || 1);

  const where = {};
  if (featured === true || featured === 'true') where.isFeatured = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
      { region: { contains: search, mode: 'insensitive' } },
      { tags: { has: String(search).toLowerCase() } },
    ];
  }

  const [total, destinations] = await Promise.all([
    prisma.destination.count({ where }),
    prisma.destination.findMany({
      where,
      include: {
        _count: { select: { trips: true, attractions: true, restaurants: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  return {
    destinations: destinations.map(destinationToJson),
    meta: { page: safePage, limit: safeLimit, total, totalPages: Math.max(1, Math.ceil(total / safeLimit)) },
  };
};

export const getDestination = async (idOrSlug) => {
  const destination = await prisma.destination.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      _count: { select: { trips: true, attractions: true, restaurants: true } },
      attractions: { orderBy: { name: 'asc' } },
      restaurants: { orderBy: { name: 'asc' } },
    },
  });

  if (!destination) throw ApiError.notFound('Destination not found.');

  return {
    destination: destinationToJson(destination),
    attractions: destination.attractions.map(attractionToJson),
    restaurants: destination.restaurants.map(restaurantToJson),
  };
};

export const popularDestinations = async (limit = 6) =>
  prisma.destination
    .findMany({
      include: { _count: { select: { trips: true, attractions: true, restaurants: true } } },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      take: limit,
    })
    .then((rows) => rows.map(destinationToJson));

export default { listDestinations, getDestination, popularDestinations };
