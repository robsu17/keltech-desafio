-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'processed', 'error');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'pending';
