import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaEpoch?: string;
};

/** Bump when schema.prisma changes so Next.js HMR does not reuse a stale client. */
const PRISMA_EPOCH = "saleitem-user-v1";

function getClient() {
  if (globalForPrisma.prisma && globalForPrisma.prismaEpoch === PRISMA_EPOCH) {
    return globalForPrisma.prisma;
  }
  void globalForPrisma.prisma?.$disconnect();
  const client = new PrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaEpoch = PRISMA_EPOCH;
  return client;
}

export const prisma = getClient();
