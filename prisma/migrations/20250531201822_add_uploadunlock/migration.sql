-- CreateTable
CREATE TABLE `assignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classroomId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOK', 'QUIZ', 'UPLOAD') NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `category` VARCHAR(191) NULL,
    `subtopic` VARCHAR(191) NULL,
    `bookId` INTEGER NULL,
    `chapterIndex` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookcontent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chapters` INTEGER NOT NULL,
    `chapterContents` VARCHAR(191) NOT NULL,
    `chapterTitle` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booklist` (
    `index` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL,
    `cover` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classroom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Classroom_code_key`(`code`),
    INDEX `Classroom_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grammarprogress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osis` INTEGER NULL,
    `anonId` VARCHAR(191) NULL,
    `concept` VARCHAR(191) NOT NULL,
    `subTopic` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quizprogress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `anonId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `subtopic` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quizprogress_userId_idx`(`userId`),
    INDEX `quizprogress_anonId_idx`(`anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `studentclassroom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NULL,
    `anonId` VARCHAR(191) NULL,
    `classroomId` INTEGER NOT NULL,

    INDEX `StudentClassroom_classroomId_fkey`(`classroomId`),
    INDEX `StudentClassroom_studentId_fkey`(`studentId`),
    INDEX `studentclassroom_anonId_idx`(`anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploadedtext` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `anonId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `uploadedtext_userId_idx`(`userId`),
    INDEX `uploadedtext_anonId_idx`(`anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `grade` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `role` ENUM('STUDENT', 'TEACHER') NOT NULL DEFAULT 'STUDENT',

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignmentcompletion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignmentId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `anonId` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `quizScore` INTEGER NULL,

    INDEX `assignmentcompletion_assignmentId_idx`(`assignmentId`),
    INDEX `assignmentcompletion_userId_idx`(`userId`),
    INDEX `assignmentcompletion_anonId_idx`(`anonId`),
    UNIQUE INDEX `assignmentcompletion_anonId_assignmentId_key`(`anonId`, `assignmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `readingprogress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `anonId` VARCHAR(191) NULL,
    `bookIndex` INTEGER NOT NULL,
    `chapterIndex` INTEGER NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `readingprogress_userId_idx`(`userId`),
    INDEX `readingprogress_anonId_idx`(`anonId`),
    INDEX `readingprogress_bookIndex_chapterIndex_idx`(`bookIndex`, `chapterIndex`),
    UNIQUE INDEX `readingprogress_anonId_bookIndex_chapterIndex_key`(`anonId`, `bookIndex`, `chapterIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploadview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `viewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `uploadview_anonId_idx`(`anonId`),
    INDEX `uploadview_uploadId_idx`(`uploadId`),
    UNIQUE INDEX `uploadview_anonId_uploadId_key`(`anonId`, `uploadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploadunlock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anonId` VARCHAR(191) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `uploadunlock_anonId_idx`(`anonId`),
    INDEX `uploadunlock_uploadId_idx`(`uploadId`),
    UNIQUE INDEX `uploadunlock_anonId_uploadId_key`(`anonId`, `uploadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assignment` ADD CONSTRAINT `assignment_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classroom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studentclassroom` ADD CONSTRAINT `studentclassroom_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studentclassroom` ADD CONSTRAINT `studentclassroom_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classroom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignmentcompletion` ADD CONSTRAINT `assignmentcompletion_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `assignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignmentcompletion` ADD CONSTRAINT `assignmentcompletion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `readingprogress` ADD CONSTRAINT `readingprogress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uploadview` ADD CONSTRAINT `uploadview_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `uploadedtext`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uploadunlock` ADD CONSTRAINT `uploadunlock_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `uploadedtext`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
