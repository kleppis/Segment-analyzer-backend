import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { env } from "./env";

export const logger = pino({ level: env.LOG_LEVEL });

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing =
      req.id ?? (req.headers["x-request-id"] as string | undefined);
    const id = existing || randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
});
