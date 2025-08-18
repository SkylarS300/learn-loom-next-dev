-- AlterTable
ALTER TABLE `classroom` ADD COLUMN `ownerAnon` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `studentclassroom` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE `Note` (
    `id` VARCHAR(191) NOT NULL,
    `anonId` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `bookIndex` INTEGER NULL,
    `uploadId` INTEGER NULL,
    `chapterIndex` INTEGER NULL,
    `sentenceIndex` INTEGER NULL,
    `wordIndex` INTEGER NULL,
    `concept` VARCHAR(191) NULL,
    `subTopic` VARCHAR(191) NULL,
    `promptHash` VARCHAR(191) NULL,
    `anchorText` VARCHAR(191) NULL,
    `body` VARCHAR(191) NOT NULL,
    `tagsJson` JSON NOT NULL,
    `color` VARCHAR(191) NULL,
    `isBookmark` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Note_anonId_createdAt_idx`(`anonId`, `createdAt`),
    INDEX `Note_anonId_targetType_bookIndex_chapterIndex_sentenceIndex_idx`(`anonId`, `targetType`, `bookIndex`, `chapterIndex`, `sentenceIndex`),
    INDEX `Note_anonId_targetType_uploadId_idx`(`anonId`, `targetType`, `uploadId`),
    INDEX `Note_anonId_targetType_concept_subTopic_idx`(`anonId`, `targetType`, `concept`, `subTopic`),
    FULLTEXT INDEX `Note_body_anchorText_idx`(`body`, `anchorText`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCode` (
    `id` VARCHAR(191) NOT NULL,
    `anonId` VARCHAR(191) NOT NULL,
    `shortCode` VARCHAR(191) NOT NULL,
    `longCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserCode_shortCode_key`(`shortCode`),
    INDEX `UserCode_anonId_idx`(`anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `classroom_ownerAnon_idx` ON `classroom`(`ownerAnon`);

-- CreateIndex
CREATE INDEX `studentclassroom_role_idx` ON `studentclassroom`(`role`);
