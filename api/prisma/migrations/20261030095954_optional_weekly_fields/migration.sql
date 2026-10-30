-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklyEval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caangId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "tanggal" TEXT NOT NULL,
    "navdarT" REAL,
    "navdarP" REAL,
    "taliT" REAL,
    "taliP" REAL,
    "ppgdT" REAL,
    "ppgdP" REAL,
    "survivalT" REAL,
    "survivalP" REAL,
    "buddy" REAL,
    "team" REAL,
    "runMin" REAL,
    "pushUp" INTEGER,
    "pullUp" INTEGER,
    "fisikScore" REAL,
    "avg" REAL,
    "catatan" TEXT,
    "mentorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "WeeklyEval_caangId_fkey" FOREIGN KEY ("caangId") REFERENCES "Caang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WeeklyEval" ("avg", "buddy", "caangId", "catatan", "createdAt", "deletedAt", "fisikScore", "id", "mentorId", "navdarP", "navdarT", "ppgdP", "ppgdT", "pullUp", "pushUp", "runMin", "survivalP", "survivalT", "syncedAt", "taliP", "taliT", "tanggal", "team", "updatedAt", "weekNo") SELECT "avg", "buddy", "caangId", "catatan", "createdAt", "deletedAt", "fisikScore", "id", "mentorId", "navdarP", "navdarT", "ppgdP", "ppgdT", "pullUp", "pushUp", "runMin", "survivalP", "survivalT", "syncedAt", "taliP", "taliT", "tanggal", "team", "updatedAt", "weekNo" FROM "WeeklyEval";
DROP TABLE "WeeklyEval";
ALTER TABLE "new_WeeklyEval" RENAME TO "WeeklyEval";
CREATE UNIQUE INDEX "WeeklyEval_caangId_weekNo_key" ON "WeeklyEval"("caangId", "weekNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
