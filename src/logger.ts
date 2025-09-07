// src/logger.ts
import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing =
      // pino-http legger evt. på req.id
      (req as any).id ??
      (req.headers["x-request-id"] as string | string[] | undefined);

    // alltid end opp med en string
    const id =
      typeof existing === "string"
        ? existing
        : Array.isArray(existing)
        ? existing[0]
        : randomUUID();

    res.setHeader("x-request-id", String(id)); // <-- viktig
    return id; // pino aksepterer string fint
  },
});
