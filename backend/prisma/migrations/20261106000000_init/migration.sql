-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FoodPreference" AS ENUM ('NO_PREFERENCE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'NON_VEGETARIAN', 'HALAL', 'KOSHER', 'BOTH');

-- CreateEnum
CREATE TYPE "TripBudgetType" AS ENUM ('TOTAL', 'PER_PERSON');

-- CreateEnum
CREATE TYPE "TravelMood" AS ENUM ('RELAXATION', 'ADVENTURE', 'NATURE', 'PHOTOGRAPHY', 'HISTORY', 'FOOD', 'ROMANTIC', 'FAMILY', 'BEACH_EXPLORATION', 'SHOPPING', 'SPIRITUAL');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('ATTRACTION', 'RESTAURANT', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITY', 'FREE_TIME');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRANSPORT', 'FOOD', 'ATTRACTION', 'ACCOMMODATION', 'SHOPPING', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "bio" TEXT,
    "homeLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "description" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "startLocation" TEXT NOT NULL,
    "travelDate" DATE NOT NULL,
    "endDate" DATE,
    "travellers" INTEGER NOT NULL DEFAULT 1,
    "budget" DECIMAL(12,2) NOT NULL,
    "availableTimeHours" INTEGER NOT NULL DEFAULT 8,
    "foodPreference" "FoodPreference" NOT NULL DEFAULT 'NO_PREFERENCE',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mood" "TravelMood",
    "moodPreferences" "TravelMood"[] DEFAULT ARRAY[]::"TravelMood"[],
    "transportationPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetType" "TripBudgetType" NOT NULL DEFAULT 'TOTAL',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cuisinePreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "foodBudgetMin" DECIMAL(10,2),
    "foodBudgetMax" DECIMAL(10,2),
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationId" TEXT,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "entryFee" DECIMAL(10,2),
    "openingHours" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "imageUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "osmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "destinationId" TEXT,

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cuisine" TEXT,
    "category" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "priceLevel" INTEGER,
    "openingHours" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "imageUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "osmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "destinationId" TEXT,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Itinerary" (
    "id" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" DATE,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'ATTRACTION',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "note" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "estimatedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "attractionId" TEXT,
    "restaurantId" TEXT,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "spentAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Trip_userId_travelDate_idx" ON "Trip"("userId", "travelDate");

-- CreateIndex
CREATE UNIQUE INDEX "Attraction_osmId_key" ON "Attraction"("osmId");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_osmId_key" ON "Restaurant"("osmId");

-- CreateIndex
CREATE INDEX "Itinerary_tripId_dayNumber_idx" ON "Itinerary"("tripId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Itinerary_tripId_dayNumber_key" ON "Itinerary"("tripId", "dayNumber");

-- CreateIndex
CREATE INDEX "ItineraryItem_itineraryId_sortOrder_idx" ON "ItineraryItem"("itineraryId", "sortOrder");

-- CreateIndex
CREATE INDEX "Expense_tripId_spentAt_idx" ON "Expense"("tripId", "spentAt");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Itinerary" ADD CONSTRAINT "Itinerary_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_attractionId_fkey" FOREIGN KEY ("attractionId") REFERENCES "Attraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
