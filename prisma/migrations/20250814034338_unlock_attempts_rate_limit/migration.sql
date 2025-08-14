-- CreateTable
CREATE TABLE `uploadunlockattempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `uploadunlockattempt_anonId_idx`(`anonId`),
    INDEX `uploadunlockattempt_uploadId_idx`(`uploadId`),
    UNIQUE INDEX `uploadunlockattempt_anonId_uploadId_key`(`anonId`, `uploadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
