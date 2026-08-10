-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('HYPERTROPHIE', 'FORCE', 'ENDURANCE', 'PERTE_DE_POIDS');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('DEBUTANT', 'INTERMEDIAIRE', 'AVANCE');

-- CreateEnum
CREATE TYPE "ExoType" AS ENUM ('POLYARTICULAIRE', 'ISOLATION', 'CARDIO');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PREVU', 'FAIT', 'MANQUE', 'REPOS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "heightCm" INTEGER,
    "goal" "Goal" NOT NULL DEFAULT 'HYPERTROPHIE',
    "level" "Level" NOT NULL DEFAULT 'DEBUTANT',
    "daysPerWeek" INTEGER NOT NULL DEFAULT 3,
    "lp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEquipment" (
    "userId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "UserEquipment_pkey" PRIMARY KEY ("userId","equipmentId")
);

-- CreateTable
CREATE TABLE "MuscleGroup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "MuscleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMuscleGroup" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "levelOffset" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserMuscleGroup_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "equipment" TEXT NOT NULL DEFAULT 'aucun',
    "level" "Level" NOT NULL DEFAULT 'DEBUTANT',
    "type" "ExoType" NOT NULL DEFAULT 'POLYARTICULAIRE',
    "description" TEXT NOT NULL,
    "progression" TEXT,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PREVU',
    "workoutId" TEXT,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "isBonus" BOOLEAN NOT NULL DEFAULT false,
    "lpEarned" INTEGER NOT NULL,
    "exercises" JSONB NOT NULL,
    "durationMin" INTEGER,
    "feeling" INTEGER,

    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLoad" (
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLoad_pkey" PRIMARY KEY ("userId","exerciseName")
);

-- CreateTable
CREATE TABLE "ApiRefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "appareil" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiHandoffCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiHandoffCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WeighIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Exercise_muscleGroup_level_idx" ON "Exercise"("muscleGroup", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "PlanDay_userId_date_idx" ON "PlanDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_userId_date_muscleGroup_key" ON "PlanDay"("userId", "date", "muscleGroup");

-- CreateIndex
CREATE INDEX "WorkoutLog_userId_date_idx" ON "WorkoutLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRefreshToken_tokenHash_key" ON "ApiRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiRefreshToken_userId_idx" ON "ApiRefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiHandoffCode_codeHash_key" ON "ApiHandoffCode"("codeHash");

-- CreateIndex
CREATE INDEX "WeighIn_userId_date_idx" ON "WeighIn"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WeighIn_userId_date_key" ON "WeighIn"("userId", "date");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEquipment" ADD CONSTRAINT "UserEquipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEquipment" ADD CONSTRAINT "UserEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMuscleGroup" ADD CONSTRAINT "UserMuscleGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMuscleGroup" ADD CONSTRAINT "UserMuscleGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLoad" ADD CONSTRAINT "ExerciseLoad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRefreshToken" ADD CONSTRAINT "ApiRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiHandoffCode" ADD CONSTRAINT "ApiHandoffCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighIn" ADD CONSTRAINT "WeighIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

