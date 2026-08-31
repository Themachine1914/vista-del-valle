import { ensurePhotoBucket, PHOTO_BUCKET } from "../src/lib/dish-photo";
import { getSupabaseAdmin } from "../src/lib/supabase";

async function main() {
  if (!getSupabaseAdmin()) {
    console.log(
      "Sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: se omite Storage. Las fotos se guardarán en disco local.",
    );
    return;
  }
  await ensurePhotoBucket();
  console.log(`Bucket "${PHOTO_BUCKET}" listo en Supabase Storage.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
