-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'mentor',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Caang" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "npm" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "fakultas" TEXT NOT NULL,
    "prodi" TEXT NOT NULL,
    "angkatan" TEXT NOT NULL,
    "mentorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Caang_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyEval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caangId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "tanggal" TEXT NOT NULL,
    "navdarT" REAL NOT NULL,
    "navdarP" REAL NOT NULL,
    "taliT" REAL NOT NULL,
    "taliP" REAL NOT NULL,
    "ppgdT" REAL NOT NULL,
    "ppgdP" REAL NOT NULL,
    "survivalT" REAL NOT NULL,
    "survivalP" REAL NOT NULL,
    "buddy" REAL NOT NULL,
    "team" REAL NOT NULL,
    "runMin" REAL NOT NULL,
    "pushUp" INTEGER NOT NULL,
    "pullUp" INTEGER NOT NULL,
    "fisikScore" REAL NOT NULL,
    "avg" REAL NOT NULL,
    "catatan" TEXT,
    "mentorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "WeeklyEval_caangId_fkey" FOREIGN KEY ("caangId") REFERENCES "Caang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageEval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caangId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "penguji" TEXT NOT NULL,
    "tanggal" TEXT NOT NULL,
    "navdarT" REAL NOT NULL,
    "navdarP" REAL NOT NULL,
    "taliT" REAL NOT NULL,
    "taliP" REAL NOT NULL,
    "ppgdT" REAL NOT NULL,
    "ppgdP" REAL NOT NULL,
    "survivalT" REAL NOT NULL,
    "survivalP" REAL NOT NULL,
    "mppT" REAL NOT NULL,
    "mppP" REAL NOT NULL,
    "rata" REAL NOT NULL,
    "keterangan" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "StageEval_caangId_fkey" FOREIGN KEY ("caangId") REFERENCES "Caang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Caang_mentorId_idx" ON "Caang"("mentorId");

-- CreateIndex
CREATE INDEX "Caang_angkatan_idx" ON "Caang"("angkatan");

-- CreateIndex
CREATE INDEX "Caang_status_idx" ON "Caang"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyEval_caangId_weekNo_key" ON "WeeklyEval"("caangId", "weekNo");

-- CreateIndex
CREATE INDEX "StageEval_caangId_stage_idx" ON "StageEval"("caangId", "stage");
