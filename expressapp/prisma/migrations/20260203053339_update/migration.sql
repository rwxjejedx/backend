/*
  Warnings:

  - You are about to drop the column `category` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `user_coupons` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `user_points` table. All the data in the column will be lost.
  - Added the required column `discount_val` to the `user_coupons` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "category",
DROP COLUMN "created_at",
DROP COLUMN "description",
DROP COLUMN "location",
ALTER COLUMN "price" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "created_at",
ALTER COLUMN "expires_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_coupons" DROP COLUMN "created_at",
ADD COLUMN     "discount_val" INTEGER NOT NULL,
ALTER COLUMN "expired_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_points" DROP COLUMN "created_at",
ALTER COLUMN "expired_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'customer',
    "referral_code" TEXT,
    "referred_by_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "max_uses" INTEGER NOT NULL,
    "expiry_date" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "event_vouchers_code_key" ON "event_vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_transaction_id_key" ON "reviews"("transaction_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_vouchers" ADD CONSTRAINT "event_vouchers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
