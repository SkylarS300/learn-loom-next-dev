-- AlterTable
ALTER TABLE `assignment`
ADD COLUMN `allowLate` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `attachmentsJson` JSON NOT NULL,
    ADD COLUMN `instructions` VARCHAR(191) NULL,
    ADD COLUMN `latePenaltyPct` INTEGER NULL,
    ADD COLUMN `startAt` DATETIME(3) NULL,
    ADD COLUMN `uploadId` INTEGER NULL,
    ADD COLUMN `weightPoints` INTEGER NULL;
-- AlterTable
ALTER TABLE `assignmentcompletion`
ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `attemptsJson` JSON NOT NULL,
    ADD COLUMN `feedback` VARCHAR(191) NULL,
    ADD COLUMN `gradedAt` DATETIME(3) NULL,
    ADD COLUMN `isLate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `scorePct` INTEGER NULL,
    ADD COLUMN `scorePoints` INTEGER NULL,
    ADD COLUMN `status` ENUM(
        'ASSIGNED',
        'SUBMITTED',
        'GRADED',
        'MISSING',
        'LATE'
    ) NOT NULL DEFAULT 'ASSIGNED',
    ADD COLUMN `submittedAt` DATETIME(3) NULL;
-- AlterTable
ALTER TABLE `studentclassroom`
ADD COLUMN `displayName` VARCHAR(191) NULL;
-- CreateTable
CREATE TABLE `assignmenttarget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignmentId` INTEGER NOT NULL,
    `anonId` VARCHAR(191) NULL,
    `overridesJson` JSON NOT NULL,
    INDEX `assignmenttarget_assignmentId_idx`(`assignmentId`),
    INDEX `assignmenttarget_anonId_idx`(`anonId`),
    UNIQUE INDEX `assignmenttarget_assignmentId_anonId_key`(`assignmentId`, `anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;