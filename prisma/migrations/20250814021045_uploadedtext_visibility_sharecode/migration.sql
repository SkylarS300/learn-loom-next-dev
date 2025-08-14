/*
  Warnings:

  - A unique constraint covering the columns `[shareCode]` on the table `uploadedtext` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `uploadedtext` ADD COLUMN `shareCode` VARCHAR(191) NULL,
    ADD COLUMN `visibility` ENUM('PRIVATE', 'CODED', 'PUBLIC') NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE UNIQUE INDEX `uploadedtext_shareCode_key` ON `uploadedtext`(`shareCode`);
