import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./env";
import { httpLogger, logger } from "./logger";
import { prisma } from "./prisma";

const app = express();

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
      req.log.error({ err: e }, "DB healthcheck failed");
      return res.status(500).json({
        error: {
          code: "DB_HEALTH_FAILED",
          message: "Database unreachable",
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
    const { segmentId } = req.params;
    const row = await prisma.segmentBestWindScore.findFirst({
      where: { segmentId },
      orderBy: [{ score: "desc" }, { id: "desc" }],
    });
    if (!row) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No score for segment",
          requestId: req.id,
        },
      });
    }
    return res.json({ segmentId, best: row });
  } catch (e) {
    next(e);
  }
});

// 404
app.use((req, res) => {
  res
    .status(404)
    .json({
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
