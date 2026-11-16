import express from "express";
import helmet from "helmet";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { syncRouter } from "./routes/sync.js";
import { browseRouter } from "./routes/browse.js";
import { usersRouter } from "./routes/users.js";
import { settingsRouter } from "./routes/settings.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
app.use(helmet());
// TODO(Phase 5): lock origin down to the PWA domain + Capacitor scheme
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "simdik-api", time: new Date().toISOString() });
});

app.use("/auth", authRouter);
app.use("/sync", requireAuth, syncRouter);
app.use("/", requireAuth, browseRouter);
app.use("/users", requireAuth, usersRouter);
app.use("/settings", requireAuth, settingsRouter);

// Never let one bad request take the API down (nginx showed crashes from an
// unhandled Prisma rejection). Log and keep serving.
app.use((err, _req, res, _next) => {
  console.error("[api] unhandled route error:", err?.message ?? err);
  res.status(500).json({ error: "internal error" });
});
process.on("unhandledRejection", (e) => console.error("[api] unhandledRejection:", e?.message ?? e));
process.on("uncaughtException", (e) => console.error("[api] uncaughtException:", e?.message ?? e));

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`simdik-api listening on :${port}`);
});
