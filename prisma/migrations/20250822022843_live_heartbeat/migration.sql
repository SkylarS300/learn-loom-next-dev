-- CreateTable
CREATE TABLE `liveheartbeat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classroomId` INTEGER NOT NULL,
    `anonId` VARCHAR(191) NOT NULL,
    `mode` ENUM('READING', 'GRAMMAR', 'UPLOAD') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `liveheartbeat_classroomId_updatedAt_idx`(`classroomId`, `updatedAt`),
    INDEX `liveheartbeat_anonId_idx`(`anonId`),
    UNIQUE INDEX `liveheartbeat_classroomId_anonId_key`(`classroomId`, `anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;