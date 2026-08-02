-- AlterTable
ALTER TABLE "taskflow"."Task" ADD COLUMN     "creatorId" UUID;

-- AddForeignKey
ALTER TABLE "taskflow"."Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "auth"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
