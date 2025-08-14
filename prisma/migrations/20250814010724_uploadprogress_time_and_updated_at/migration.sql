-- AlterTable
ALTER TABLE `uploadprogress` ADD COLUMN `timeMs` INTEGER NOT NULL DEFAULT 0,
    ALTER COLUMN `updatedAt` DROP DEFAULT;
