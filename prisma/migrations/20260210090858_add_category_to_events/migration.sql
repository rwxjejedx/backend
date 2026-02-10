-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('MUSIC', 'NIGHTLIFE', 'WORKSHOP', 'FOOD', 'CONFERENCE', 'SPORTS');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "category" "EventCategory" NOT NULL DEFAULT 'WORKSHOP';

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
