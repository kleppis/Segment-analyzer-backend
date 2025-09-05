import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ emit: "event", level: "query" }, "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Optional: log queries (verbose in dev)
prisma.$on("query", (e) => {
  if (process.env.NODE_ENV !== "production") {
    // console.log(`QUERY: ${e.query} -- ${e.params}`);
  }
});
