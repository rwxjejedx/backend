-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT NOT NULL DEFAULT 'temporary_password';
