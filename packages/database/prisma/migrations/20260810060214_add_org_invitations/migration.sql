-- CreateEnum
CREATE TYPE "taskflow"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "taskflow"."NotificationType" ADD VALUE 'INVITATION_ACCEPTED';
ALTER TYPE "taskflow"."NotificationType" ADD VALUE 'INVITATION_DECLINED';

-- CreateTable
CREATE TABLE "taskflow"."Invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orgId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "taskflow"."Role" NOT NULL DEFAULT 'MEMBER',
    "status" "taskflow"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "taskflow"."Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_status_idx" ON "taskflow"."Invitation"("email", "status");

-- CreateIndex
CREATE INDEX "Invitation_orgId_status_idx" ON "taskflow"."Invitation"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_orgId_email_key" ON "taskflow"."Invitation"("orgId", "email");

-- AddForeignKey
ALTER TABLE "taskflow"."Invitation" ADD CONSTRAINT "Invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "taskflow"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taskflow"."Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "auth"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-added: PSL can't express "any Role except one value". A future
-- `prisma migrate dev` reporting drift on this table should re-add this
-- constraint in the generated migration, not drop it - see the Invitation
-- model's docblock in schema.prisma.
ALTER TABLE "taskflow"."Invitation" ADD CONSTRAINT "Invitation_role_not_owner" CHECK ("role" <> 'OWNER');
