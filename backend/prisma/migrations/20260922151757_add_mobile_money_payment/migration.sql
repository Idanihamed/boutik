-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_INFO_CHANGED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentReference" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "mobileMoneyNumber" TEXT,
ADD COLUMN     "mobileMoneyProvider" TEXT;
