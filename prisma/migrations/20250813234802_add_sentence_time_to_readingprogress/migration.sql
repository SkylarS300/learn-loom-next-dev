/*
  Warnings:

  - Added the required column `updatedAt` to the `readingprogress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `readingprogress` ADD COLUMN `sentenceIndex` INTEGER NULL,
    ADD COLUMN `timeMs` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `uploadprogress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `paraIndex` INTEGER NOT NULL DEFAULT 0,
    `charOffset` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `uploadprogress_anonId_idx`(`anonId`),
    INDEX `uploadprogress_uploadId_idx`(`uploadId`),
    UNIQUE INDEX `uploadprogress_anonId_uploadId_key`(`anonId`, `uploadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `uploadprogress` ADD CONSTRAINT `uploadprogress_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `uploadedtext`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
