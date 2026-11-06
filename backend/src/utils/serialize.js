const toDateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

const toMoney = (value) => (value === null || value === undefined ? 0 : Number(value));

export const userToJson = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  bio: user.bio ?? null,
  homeLocation: user.homeLocation ?? null,
  createdAt: toDateOnly(user.createdAt),
});

export const tripToJson = (trip) => ({
  id: trip.id,
  title: trip.title,
  destinationName: trip.destinationName,
  startLocation: trip.startLocation,
  travelDate: toDateOnly(trip.travelDate),
  endDate: toDateOnly(trip.endDate),
  travellers: trip.travellers,
  budget: toMoney(trip.budget),
  availableTimeHours: trip.availableTimeHours,
  foodPreference: trip.foodPreference,
  interests: trip.interests ?? [],
  mood: trip.mood ?? null,
  moodPreferences: trip.moodPreferences ?? (trip.mood ? [trip.mood] : []),
  transportationPreferences: trip.transportationPreferences ?? [],
  budgetType: trip.budgetType ?? 'TOTAL',
  currency: trip.currency ?? 'USD',
  cuisinePreferences: trip.cuisinePreferences ?? [],
  foodBudgetMin: trip.foodBudgetMin == null ? null : toMoney(trip.foodBudgetMin),
  foodBudgetMax: trip.foodBudgetMax == null ? null : toMoney(trip.foodBudgetMax),
  status: trip.status,
  notes: trip.notes ?? null,
  lat: trip.lat ?? null,
  lng: trip.lng ?? null,
  startLat: trip.startLat ?? null,
  startLng: trip.startLng ?? null,
  destinationId: trip.destinationId ?? null,
  userId: trip.userId,
  createdAt: toDateOnly(trip.createdAt),
  updatedAt: toDateOnly(trip.updatedAt),
  destination: trip.destination ? destinationToJson(trip.destination) : null,
  meta: trip.meta ?? undefined,
});

export const destinationToJson = (destination) => ({
  id: destination.id,
  name: destination.name,
  slug: destination.slug,
  country: destination.country,
  region: destination.region ?? null,
  description: destination.description ?? null,
  lat: destination.lat,
  lng: destination.lng,
  imageUrl: destination.imageUrl ?? null,
  tags: destination.tags ?? [],
  isFeatured: destination.isFeatured,
  _count: destination._count ?? undefined,
});

export const attractionToJson = (attraction) => ({
  id: attraction.id,
  name: attraction.name,
  description: attraction.description ?? null,
  category: attraction.category ?? null,
  address: attraction.address ?? null,
  lat: attraction.lat,
  lng: attraction.lng,
  entryFee: attraction.entryFee === null || attraction.entryFee === undefined
    ? null
    : toMoney(attraction.entryFee),
  openingHours: attraction.openingHours ?? null,
  website: attraction.website ?? null,
  phone: attraction.phone ?? null,
  rating: attraction.rating ?? null,
  source: attraction.source,
  destinationId: attraction.destinationId ?? null,
});

export const restaurantToJson = (restaurant) => ({
  id: restaurant.id,
  name: restaurant.name,
  description: restaurant.description ?? null,
  cuisine: restaurant.cuisine ?? null,
  category: restaurant.category ?? null,
  address: restaurant.address ?? null,
  lat: restaurant.lat,
  lng: restaurant.lng,
  priceLevel: restaurant.priceLevel ?? null,
  openingHours: restaurant.openingHours ?? null,
  website: restaurant.website ?? null,
  phone: restaurant.phone ?? null,
  rating: restaurant.rating ?? null,
  source: restaurant.source,
  destinationId: restaurant.destinationId ?? null,
});

export const itemToJson = (item) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  description: item.description ?? null,
  note: item.note ?? null,
  lat: item.lat ?? null,
  lng: item.lng ?? null,
  durationMinutes: item.durationMinutes,
  estimatedCost: toMoney(item.estimatedCost),
  sortOrder: item.sortOrder,
  itineraryId: item.itineraryId,
  attractionId: item.attractionId ?? null,
  restaurantId: item.restaurantId ?? null,
  attraction: item.attraction ? attractionToJson(item.attraction) : null,
  restaurant: item.restaurant ? restaurantToJson(item.restaurant) : null,
});

export const itineraryToJson = (itinerary) => ({
  id: itinerary.id,
  dayNumber: itinerary.dayNumber,
  date: toDateOnly(itinerary.date),
  title: itinerary.title ?? null,
  items: (itinerary.items ?? []).map(itemToJson),
  totalMinutes: (itinerary.items ?? []).reduce((sum, item) => sum + item.durationMinutes, 0),
  totalCost: (itinerary.items ?? []).reduce((sum, item) => sum + toMoney(item.estimatedCost), 0),
});

export const expenseToJson = (expense) => ({
  id: expense.id,
  category: expense.category,
  amount: toMoney(expense.amount),
  description: expense.description,
  spentAt: toDateOnly(expense.spentAt),
  createdAt: toDateOnly(expense.createdAt),
});

export const budgetToJson = (budget) => ({ ...budget });

export default tripToJson;
