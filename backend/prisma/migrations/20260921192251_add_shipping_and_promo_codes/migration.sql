-- CreateEnum
CREATE TYPE "PromoCodeType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "shippingFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "freeShippingThreshold" INTEGER,
ADD COLUMN     "shippingFee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "type" "PromoCodeType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minOrderAmount" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promo_codes_businessId_idx" ON "promo_codes"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_businessId_code_key" ON "promo_codes"("businessId", "code");

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
