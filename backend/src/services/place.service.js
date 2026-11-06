import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { attractionToJson, restaurantToJson } from '../utils/serialize.js';

const osmKeyOf = (place) => {
  if (!place?.osmType || !place?.osmId) return null;
  return `osm-${place.osmType}-${place.osmId}`;
};

const uniqueOsmId = (place) => {
  const key = osmKeyOf(place);
  return key || null;
};

export const resolveAttraction = async (place, destinationId) => {
  if (place?.osmType && place?.osmId) {
    const existing = await prisma.attraction.findUnique({
      where: { osmId: uniqueOsmId(place) },
    });
    if (existing) {
      if (!existing.destinationId && destinationId) {
        return prisma.attraction.update({
          where: { id: existing.id },
          data: { destinationId },
        });
      }
      return existing;
    }
  }

  return prisma.attraction.create({
    data: {
      name: place?.name || 'Saved attraction',
      description: place?.description ?? null,
      category: place?.category ?? null,
      address: place?.address ?? null,
      lat: Number(place.lat),
      lng: Number(place.lng),
      entryFee: place?.entryFee ?? null,
      openingHours: place?.openingHours ?? null,
      website: place?.website ?? null,
      phone: place?.phone ?? null,
      rating: place?.rating ?? null,
      source: place?.osmId ? 'osm' : 'manual',
      osmId: uniqueOsmId(place),
      destinationId: destinationId ?? null,
    },
  });
};

export const resolveRestaurant = async (place, destinationId) => {
  if (place?.osmType && place?.osmId) {
    const existing = await prisma.restaurant.findUnique({
      where: { osmId: uniqueOsmId(place) },
    });
    if (existing) {
      if (!existing.destinationId && destinationId) {
        return prisma.restaurant.update({
          where: { id: existing.id },
          data: { destinationId },
        });
      }
      return existing;
    }
  }

  return prisma.restaurant.create({
    data: {
      name: place?.name || 'Saved restaurant',
      description: place?.description ?? null,
      cuisine: place?.cuisine ?? null,
      category: place?.category ?? null,
      address: place?.address ?? null,
      lat: Number(place.lat),
      lng: Number(place.lng),
      priceLevel: place?.priceLevel ?? null,
      openingHours: place?.openingHours ?? null,
      website: place?.website ?? null,
      phone: place?.phone ?? null,
      rating: place?.rating ?? null,
      source: place?.osmId ? 'osm' : 'manual',
      osmId: uniqueOsmId(place),
      destinationId: destinationId ?? null,
    },
  });
};

export const searchSavedAttractions = async (destinationId) => {
  if (!destinationId) return [];
  const rows = await prisma.attraction.findMany({
    where: { destinationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(attractionToJson);
};

export const searchSavedRestaurants = async (destinationId) => {
  if (!destinationId) return [];
  const rows = await prisma.restaurant.findMany({
    where: { destinationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(restaurantToJson);
};

export default { resolveAttraction, resolveRestaurant, searchSavedAttractions, searchSavedRestaurants };
