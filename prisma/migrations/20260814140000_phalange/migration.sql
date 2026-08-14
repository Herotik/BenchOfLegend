-- CreateEnum
CREATE TYPE "StatutAmitie" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "codeAmi" TEXT;

-- CreateTable
CREATE TABLE "Amitie" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "statut" "StatutAmitie" NOT NULL DEFAULT 'EN_ATTENTE',
    "paire" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reponduLe" TIMESTAMP(3),

    CONSTRAINT "Amitie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Amitie_paire_key" ON "Amitie"("paire");

-- CreateIndex
CREATE INDEX "Amitie_demandeurId_statut_idx" ON "Amitie"("demandeurId", "statut");

-- CreateIndex
CREATE INDEX "Amitie_destinataireId_statut_idx" ON "Amitie"("destinataireId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "User_codeAmi_key" ON "User"("codeAmi");

-- AddForeignKey
ALTER TABLE "Amitie" ADD CONSTRAINT "Amitie_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amitie" ADD CONSTRAINT "Amitie_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

