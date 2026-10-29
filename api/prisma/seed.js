import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme123";

if (adminPassword === "changeme123") {
  console.warn("[seed] WARNING: using default admin password — set SEED_ADMIN_PASSWORD before real use.");
}

// Same sample data as the original site so the UI looks familiar during the pilot.
const sampleCaang = [
  { id: "caang-1", npm: "2023011001", nama: "Ahmad Rizky", fakultas: "Teknik", prodi: "Informatika", angkatan: "34", mentor: "Senior Budi" },
  { id: "caang-2", npm: "2023011002", nama: "Siti Nurhaliza", fakultas: "Ekonomi", prodi: "Manajemen", angkatan: "34", mentor: "Senior Dewi" },
  { id: "caang-3", npm: "2023011003", nama: "Bambang Perkasa", fakultas: "Hukum", prodi: "Ilmu Hukum", angkatan: "34", mentor: "Senior Budi" },
];

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: { username: adminUsername, passwordHash, displayName: "Admin Kapal Baja", role: "admin" },
  });

  await prisma.user.upsert({
    where: { username: "mentor" },
    update: {},
    create: { username: "mentor", passwordHash, displayName: "Senior Mentor", role: "mentor" },
  });

  for (const c of sampleCaang) {
    await prisma.caang.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        npm: c.npm,
        nama: c.nama,
        fakultas: c.fakultas,
        prodi: c.prodi,
        angkatan: c.angkatan,
        mentorId: admin.id,
      },
    });
  }

  console.log(`[seed] ok: admin="${adminUsername}", mentor="mentor", ${sampleCaang.length} sample caang`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
