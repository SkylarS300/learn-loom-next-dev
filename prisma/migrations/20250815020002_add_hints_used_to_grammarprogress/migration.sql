-- AlterTable
ALTER TABLE `grammarprogress` ADD COLUMN `hintsUsed` INTEGER NULL;

-- CreateIndex
CREATE INDEX `grammarprogress_anonId_idx` ON `grammarprogress`(`anonId`);

-- CreateIndex
CREATE INDEX `grammarprogress_concept_subTopic_idx` ON `grammarprogress`(`concept`, `subTopic`);
