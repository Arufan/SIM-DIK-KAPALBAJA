-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Caang" (
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
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Caang_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Caang" ("angkatan", "createdAt", "deletedAt", "fakultas", "id", "mentorId", "nama", "npm", "prodi", "status", "updatedAt") SELECT "angkatan", "createdAt", "deletedAt", "fakultas", "id", "mentorId", "nama", "npm", "prodi", "status", "updatedAt" FROM "Caang";
DROP TABLE "Caang";
ALTER TABLE "new_Caang" RENAME TO "Caang";
CREATE INDEX "Caang_mentorId_idx" ON "Caang"("mentorId");
CREATE INDEX "Caang_angkatan_idx" ON "Caang"("angkatan");
CREATE INDEX "Caang_status_idx" ON "Caang"("status");
CREATE TABLE "new_StageEval" (
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
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "StageEval_caangId_fkey" FOREIGN KEY ("caangId") REFERENCES "Caang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StageEval" ("caangId", "createdAt", "deletedAt", "id", "keterangan", "mppP", "mppT", "navdarP", "navdarT", "penguji", "ppgdP", "ppgdT", "rata", "stage", "survivalP", "survivalT", "taliP", "taliT", "tanggal", "updatedAt") SELECT "caangId", "createdAt", "deletedAt", "id", "keterangan", "mppP", "mppT", "navdarP", "navdarT", "penguji", "ppgdP", "ppgdT", "rata", "stage", "survivalP", "survivalT", "taliP", "taliT", "tanggal", "updatedAt" FROM "StageEval";
DROP TABLE "StageEval";
ALTER TABLE "new_StageEval" RENAME TO "StageEval";
CREATE INDEX "StageEval_caangId_stage_idx" ON "StageEval"("caangId", "stage");
CREATE TABLE "new_WeeklyEval" (
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
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "WeeklyEval_caangId_fkey" FOREIGN KEY ("caangId") REFERENCES "Caang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WeeklyEval" ("avg", "buddy", "caangId", "catatan", "createdAt", "deletedAt", "fisikScore", "id", "mentorId", "navdarP", "navdarT", "ppgdP", "ppgdT", "pullUp", "pushUp", "runMin", "survivalP", "survivalT", "taliP", "taliT", "tanggal", "team", "updatedAt", "weekNo") SELECT "avg", "buddy", "caangId", "catatan", "createdAt", "deletedAt", "fisikScore", "id", "mentorId", "navdarP", "navdarT", "ppgdP", "ppgdT", "pullUp", "pushUp", "runMin", "survivalP", "survivalT", "taliP", "taliT", "tanggal", "team", "updatedAt", "weekNo" FROM "WeeklyEval";
DROP TABLE "WeeklyEval";
ALTER TABLE "new_WeeklyEval" RENAME TO "WeeklyEval";
CREATE UNIQUE INDEX "WeeklyEval_caangId_weekNo_key" ON "WeeklyEval"("caangId", "weekNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
