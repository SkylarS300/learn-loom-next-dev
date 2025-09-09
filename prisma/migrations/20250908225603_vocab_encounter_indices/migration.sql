-- CreateTable
CREATE TABLE `Word` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lemma` VARCHAR(191) NOT NULL,
    `display` VARCHAR(191) NULL,
    `phonetics` VARCHAR(191) NULL,
    `pos` VARCHAR(191) NULL,
    `cefrLevel` ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Word_lemma_idx`(`lemma`),
    INDEX `Word_cefrLevel_pos_idx`(`cefrLevel`, `pos`),
    UNIQUE INDEX `Word_lemma_pos_key`(`lemma`, `pos`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WordEncounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `wordId` INTEGER NOT NULL,
    `source` ENUM('BOOK', 'UPLOAD', 'GRAMMAR', 'LOOKUP') NOT NULL,
    `bookIndex` INTEGER NULL,
    `chapterIndex` INTEGER NULL,
    `sentenceIndex` INTEGER NULL,
    `uploadId` INTEGER NULL,
    `concept` VARCHAR(191) NULL,
    `subTopic` VARCHAR(191) NULL,
    `context` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WordEncounter_anonId_createdAt_idx`(`anonId`, `createdAt`),
    INDEX `WordEncounter_wordId_idx`(`wordId`),
    INDEX `WordEncounter_anonId_wordId_source_idx`(`anonId`, `wordId`, `source`),
    INDEX `WordEncounter_source_createdAt_idx`(`source`, `createdAt`),
    INDEX `WordEncounter_bookIndex_chapterIndex_sentenceIndex_idx`(`bookIndex`, `chapterIndex`, `sentenceIndex`),
    INDEX `WordEncounter_uploadId_idx`(`uploadId`),
    INDEX `WordEncounter_concept_subTopic_idx`(`concept`, `subTopic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WordStudy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `wordId` INTEGER NOT NULL,
    `ease` INTEGER NOT NULL DEFAULT 130,
    `reps` INTEGER NOT NULL DEFAULT 0,
    `lapses` INTEGER NOT NULL DEFAULT 0,
    `intervalDays` INTEGER NOT NULL DEFAULT 0,
    `nextDue` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastResult` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WordStudy_anonId_nextDue_idx`(`anonId`, `nextDue`),
    UNIQUE INDEX `WordStudy_anonId_wordId_key`(`anonId`, `wordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GrammarAbility` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `concept` VARCHAR(191) NOT NULL,
    `subTopic` VARCHAR(191) NOT NULL,
    `ability` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GrammarAbility_updatedAt_idx`(`updatedAt`),
    INDEX `GrammarAbility_concept_subTopic_idx`(`concept`, `subTopic`),
    UNIQUE INDEX `GrammarAbility_anonId_concept_subTopic_key`(`anonId`, `concept`, `subTopic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
