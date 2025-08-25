/*
  Warnings:

  - A unique constraint covering the columns `[classroomId,anonId]` on the table `studentclassroom` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `studentclassroom_classroomId_anonId_key` ON `studentclassroom`(`classroomId`, `anonId`);
