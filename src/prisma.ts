// src/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["info", "warn", "error"], // <-- fjern event-emitter config
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// (fjern prisma.$on('query', ...))
