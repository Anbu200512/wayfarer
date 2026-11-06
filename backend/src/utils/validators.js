import { z } from 'zod';
import ApiError from './ApiError.js';

export const FOOD_PREFERENCES = [
  'NO_PREFERENCE',
  'VEGETARIAN',
  'VEGAN',
  'PESCATARIAN',
  'NON_VEGETARIAN',
  'HALAL',
  'KOSHER',
  'BOTH',
];

export const TRIP_STATUSES = ['PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
export const ITEM_TYPES = ['ATTRACTION', 'RESTAURANT', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITY', 'FREE_TIME'];
export const EXPENSE_CATEGORIES = ['TRANSPORT', 'FOOD', 'ATTRACTION', 'ACCOMMODATION', 'SHOPPING', 'OTHER'];

const dateString = z
  .string()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value, { message: 'Invalid calendar date' });

const selectedLocationSchema = z.object({
  id: z.string().min(3), name: z.string().trim().min(2).max(160), label: z.string().trim().min(3).max(300),
  lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180),
  type: z.string().max(80).optional(), city: z.string().max(120).nullable().optional(), state: z.string().max(120).nullable().optional(),
}).passthrough();

export const wizardDraftSchema = z.object({ destination: selectedLocationSchema });
export const wizardProgressSchema = z.object({
  state: z.object({
    stage: z.coerce.number().int().min(1).max(14),
    destination: selectedLocationSchema,
    departure: selectedLocationSchema.nullable().optional(),
    mode: z.enum(['TRAIN','BUS','FLIGHT','CAR','BIKE','OWN_VEHICLE']).nullable().optional(),
    trainNumber: z.string().regex(/^\d{1,6}$/).nullable().optional(),
    date: dateString.nullable().optional(), departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    days: z.coerce.number().int().min(1).max(30).nullable().optional(),
    travellers: z.coerce.number().int().min(1).max(50).nullable().optional(),
    arrivalDate: dateString.nullable().optional(), arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), arrivalSource: z.enum(['USER_ENTERED','PROVIDER']).nullable().optional(),
    journeyConfirmed: z.boolean().default(false),
    accommodation: z.enum(['skip','own']).nullable().optional(), hotel: selectedLocationSchema.nullable().optional(),
    localMode: z.enum(['METRO','BUS','CAB','AUTO','BIKE','WALK']).nullable().optional(),
    preferences: z.object({ days: z.coerce.number().int().min(1).max(30), budget: z.coerce.number().positive().max(10_000_000), currency: z.string().regex(/^[A-Z]{3}$/), availableHours: z.coerce.number().min(2).max(18), moods: z.array(z.string()).max(11), interests: z.array(z.string().max(40)).max(12), foodPreference: z.enum(FOOD_PREFERENCES), cuisines: z.array(z.string()).max(7), foodBudgetMin: z.coerce.number().min(0).max(100_000).nullable(), foodBudgetMax: z.coerce.number().min(0).max(100_000).nullable(), instructions: z.string().max(2000) }).nullable().optional(),
    finalConfirmed: z.boolean().default(false),
  }).passthrough(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  homeLocation: z.string().trim().max(120).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
});

export const tripSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  destinationName: z.string().trim().min(2, 'Destination is required').max(120),
  startLocation: z.string().trim().min(2, 'Starting location is required').max(120),
  travelDate: dateString,
  endDate: dateString.nullable().optional(),
  travellers: z.coerce.number().int().min(1).max(50).default(1),
  budget: z.coerce.number().min(0, 'Budget must be positive').max(10_000_000),
  availableTimeHours: z.coerce.number().int().min(1).max(720).default(8),
  foodPreference: z.enum(FOOD_PREFERENCES).default('NO_PREFERENCE'),
  interests: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  mood: z.enum(['RELAXATION', 'ADVENTURE', 'NATURE', 'PHOTOGRAPHY', 'HISTORY', 'FOOD', 'ROMANTIC', 'FAMILY', 'BEACH_EXPLORATION', 'SHOPPING', 'SPIRITUAL']).nullable().optional(),
  moodPreferences: z.array(z.enum(['RELAXATION', 'ADVENTURE', 'NATURE', 'PHOTOGRAPHY', 'HISTORY', 'FOOD', 'ROMANTIC', 'FAMILY', 'BEACH_EXPLORATION', 'SHOPPING', 'SPIRITUAL'])).max(11).default([]),
  transportationPreferences: z.array(z.enum(['TRAIN', 'BUS', 'CAR', 'BIKE', 'FLIGHT', 'OWN_VEHICLE'])).max(6).default([]),
  budgetType: z.enum(['TOTAL', 'PER_PERSON']).default('TOTAL'),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('USD'),
  cuisinePreferences: z.array(z.enum(['SOUTH_INDIAN', 'NORTH_INDIAN', 'CHINESE', 'ITALIAN', 'CONTINENTAL', 'STREET_FOOD', 'SEAFOOD'])).max(7).default([]),
  foodBudgetMin: z.coerce.number().min(0).max(100_000).nullable().optional(),
  foodBudgetMax: z.coerce.number().min(0).max(100_000).nullable().optional(),
  status: z.enum(TRIP_STATUSES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  startLat: z.coerce.number().nullable().optional(),
  startLng: z.coerce.number().nullable().optional(),
  destinationId: z.string().nullable().optional(),
}).superRefine((trip, ctx) => {
  if (trip.foodBudgetMin != null && trip.foodBudgetMax != null && trip.foodBudgetMin > trip.foodBudgetMax) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['foodBudgetMax'], message: 'Maximum meal budget must be at least the minimum.' });
  }
  if (trip.endDate && trip.endDate < trip.travelDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Return date must be on or after the travel start date.' });
  }
});

export const itineraryDaySchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(60).optional(),
  date: dateString.nullable().optional(),
  title: z.string().trim().max(80).nullable().optional(),
});

export const itineraryItemSchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(60).default(1),
  type: z.enum(ITEM_TYPES).default('ATTRACTION'),
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  estimatedCost: z.coerce.number().min(0).max(1_000_000).default(0),
  attractionId: z.string().nullable().optional(),
  restaurantId: z.string().nullable().optional(),
  destinationId: z.string().nullable().optional(),
  place: z
    .object({
      osmType: z.string().max(20).optional(),
      osmId: z.union([z.string(), z.number()]).optional(),
      category: z.string().max(80).nullable().optional(),
      address: z.string().max(240).nullable().optional(),
      openingHours: z.string().max(160).nullable().optional(),
      website: z.string().max(300).nullable().optional(),
      phone: z.string().max(60).nullable().optional(),
      cuisine: z.string().max(120).nullable().optional(),
      priceLevel: z.coerce.number().int().min(1).max(5).nullable().optional(),
      entryFee: z.coerce.number().min(0).nullable().optional(),
      description: z.string().max(600).nullable().optional(),
      rating: z.coerce.number().min(0).max(5).nullable().optional(),
    })
    .optional(),
});

export const updateItemSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  dayNumber: z.coerce.number().int().min(1).max(60).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  estimatedCost: z.coerce.number().min(0).max(1_000_000).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  type: z.enum(ITEM_TYPES).optional(),
});

export const reorderSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, 'At least one item id is required'),
});

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().min(0, 'Amount must be positive').max(1_000_000),
  description: z.string().trim().min(1, 'Description is required').max(200),
  spentAt: dateString,
});
export const expenseUpdateSchema = expenseSchema.partial().refine((data) => Object.keys(data).length > 0, 'At least one expense field is required');

export const recommendationSchema = z.object({
  tripId: z.string().min(1).optional(),
  discoveryType: z.enum(['ATTRACTIONS','RESTAURANTS','ITINERARY']).default('ITINERARY'),
  destination: z.string().trim().min(2).max(120),
  travelDate: dateString,
  travellers: z.coerce.number().int().min(1).max(50),
  budget: z.coerce.number().positive().max(10_000_000),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('USD'),
  days: z.coerce.number().int().min(1).max(60).default(1),
  availableHours: z.coerce.number().min(2).max(18).default(8),
  interests: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  foodPreference: z.enum(FOOD_PREFERENCES).default('NO_PREFERENCE'),
  cuisine: z.string().trim().max(100).default(''),
  experience: z.string().trim().max(240).default(''),
  mood: z.enum(['RELAXATION', 'ADVENTURE', 'NATURE', 'PHOTOGRAPHY', 'HISTORY', 'FOOD', 'ROMANTIC', 'FAMILY', 'BEACH_EXPLORATION', 'SHOPPING', 'SPIRITUAL']).default('RELAXATION'),
  startLocation: z.string().trim().max(120).default(''),
  days: z.coerce.number().int().min(1).max(60).default(1),
  budgetType: z.enum(['TOTAL', 'PER_PERSON']).default('TOTAL'),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default('USD'),
  transportationPreferences: z.array(z.enum(['TRAIN', 'BUS', 'CAR', 'BIKE', 'FLIGHT', 'OWN_VEHICLE'])).max(6).default([]),
  moodPreferences: z.array(z.enum(['RELAXATION', 'ADVENTURE', 'NATURE', 'PHOTOGRAPHY', 'HISTORY', 'FOOD', 'ROMANTIC', 'FAMILY', 'BEACH_EXPLORATION', 'SHOPPING', 'SPIRITUAL'])).max(11).default([]),
  cuisinePreferences: z.array(z.enum(['SOUTH_INDIAN', 'NORTH_INDIAN', 'CHINESE', 'ITALIAN', 'CONTINENTAL', 'STREET_FOOD', 'SEAFOOD'])).max(7).default([]),
  foodBudgetMin: z.coerce.number().min(0).max(100_000).nullable().optional(),
  foodBudgetMax: z.coerce.number().min(0).max(100_000).nullable().optional(),
  idealTrip: z.string().trim().max(2000).default(''),
}).superRefine((preferences, ctx) => {
  if (preferences.foodBudgetMin != null && preferences.foodBudgetMax != null && preferences.foodBudgetMin > preferences.foodBudgetMax) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['foodBudgetMax'], message: 'Maximum meal budget must be at least the minimum.' });
  }
});

export const recoveryPreviewSchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(60).default(1),
  unavailableItemIds: z.array(z.string().min(1)).max(100).default([]),
  additionalExpense: z.coerce.number().min(0).max(10_000_000).default(0),
  remainingTimeMinutes: z.coerce.number().int().min(0).max(43200).optional(),
  radiusMeters: z.coerce.number().int().min(500).max(25000).default(10000),
});
export const recoveryAcceptSchema = recoveryPreviewSchema;

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[source] = result.data;
    return next();
  };

export default validate;
