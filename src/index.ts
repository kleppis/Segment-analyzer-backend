import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./env";
import { httpLogger, logger } from "./logger";
import { prisma } from "./prisma";

const app = express();
app.set("json replacer", (_key, value) =>
  typeof value === "bigint" ? value.toString() : value
);

// CORS – tillat kun Vercel-domenet i nettleser (server-til-server uten Origin er ok)
const allowed = env.ALLOWED_ORIGIN;
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // tillat curl/serverside uten Origin
      if (origin === allowed) return cb(null, true);
      cb(new Error("CORS: Origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: false,
    maxAge: 600,
  })
);

app.use(express.json());
app.use(httpLogger);

// Healthcheck (legg til ?db=1 for å sjekke DB)
app.get("/health", async (req, res) => {
  if (req.query.db) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return res.json({ ok: true, db: "up" });
    } catch (e: any) {
      // LOGG MER DETALJER TIL SERVER-LOGG
      req.log.error(
        {
          err: e,
          prismaCode: e?.code,
          prismaClientVersion: e?.clientVersion,
          meta: e?.meta,
        },
        "DB healthcheck failed"
      );
      // returnér en trygg, litt mer hjelpsom feilmelding til klient (uten secrets)
      return res.status(500).json({
        error: {
          code: "DB_HEALTH_FAILED",
          message: e?.message || "Database unreachable",
          hint: "Sjekk SQL-auth, firewall, og DATABASE_URL",
          requestId: req.id,
        },
      });
    }
  }
  res.json({ ok: true });
});

// Version (hentes fra package.json via env eller hardkod)
const version = process.env.npm_package_version || "1.0.0";
app.get("/version", (req, res) => {
  res.json({ version, node: process.version });
});

// Eksempel-API: hent beste score for et segment
app.get("/api/best/:segmentId", async (req, res, next) => {
  try {
    const raw = req.params.segmentId; // <- "632847"
    // Sjekk at det er bare siffer
    if (!/^\d+$/.test(raw)) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "segmentId must be digits only",
        },
      });
    }

    // Hvis Prisma-modellen har BigInt: konverter
    const idAsBigInt = BigInt(raw);

    const row = await prisma.segmentBestWindScore.findFirst({
      where: { segmentId: idAsBigInt as any }, // <- hvis modellfeltet er BigInt
      orderBy: [{ bestWindScore: "desc" }],
    });

    if (!row) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "No score for segment" },
      });
    }
    return res.json({ segmentId: raw, best: row });
  } catch (e) {
    next(e);
  }
});

app.get("/api/users", async (req, res, next) => {
  try {
    const take = Math.min(
      parseInt(String(req.query.take ?? "50"), 10) || 50,
      200
    );
    const users = await prisma.user.findMany({ take, orderBy: { id: "desc" } });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      requestId: (req as any).id,
    },
  });
});

// Global error handler – strukturerte 5xx
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled error");
  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  res.status(status).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message || String(err),
      requestId: (req as any).id,
      ...(env.NODE_ENV === "production" ? {} : { stack: err.stack }),
    },
  });
});

// Start server
app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, allowedOrigin: allowed },
    "Server started"
  );
});
