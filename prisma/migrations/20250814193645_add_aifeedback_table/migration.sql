-- CreateTable
CREATE TABLE `aifeedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NULL,
    `concept` VARCHAR(191) NOT NULL,
    `subTopic` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `issue` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `aifeedback_anonId_idx`(`anonId`),
    INDEX `aifeedback_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
