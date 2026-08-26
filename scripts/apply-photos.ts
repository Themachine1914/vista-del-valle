import { PrismaClient } from "@prisma/client";
import photoMap from "../prisma/photo-map.json";

const prisma = new PrismaClient();

async function main() {
  for (const [id, foto] of Object.entries(photoMap)) {
    const dish = await prisma.dish.update({
      where: { id },
      data: { foto },
    });
    console.log(`${dish.id} → ${foto}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
