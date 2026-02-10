-- AlterTable
ALTER TABLE "events" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'TBA',
ADD COLUMN     "venue" TEXT NOT NULL DEFAULT 'TBA';
