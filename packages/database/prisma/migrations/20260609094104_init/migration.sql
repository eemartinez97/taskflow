/*
  Warnings:

  - You are about to drop the column `taskId` on the `Label` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "taskflow"."Label" DROP CONSTRAINT "Label_taskId_fkey";

-- AlterTable
ALTER TABLE "taskflow"."Attachment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "taskflow"."Board" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "taskflow"."Column" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "taskflow"."Comment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "taskflow"."Label" DROP COLUMN "taskId",
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "taskflow"."Project" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "taskflow"."Task" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- CreateIndex
CREATE INDEX "Board_projectId_idx" ON "taskflow"."Board"("projectId");
