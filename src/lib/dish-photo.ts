import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { getSupabaseAdmin } from "./supabase";

export const PHOTO_BUCKET = "platos";
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export function photoExtension(filename: string, mimeType?: string): string {
  const fromName = extname(filename).toLowerCase();
  if (ALLOWED_EXTS.has(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName;
  }
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return ".jpg";
}

export function photoObjectPath(
  dishId: string,
  filename: string,
  mimeType?: string,
  now = Date.now(),
): string {
  const safeId = dishId.replace(/[^a-z0-9_-]/gi, "") || "plato";
  return `${safeId}/${now}${photoExtension(filename, mimeType)}`;
}

export function assertImageFile(file: {
  name: string;
  type: string;
  size: number;
}): void {
  if (file.size <= 0) throw new Error("Selecciona una imagen");
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("La imagen no puede superar 8 MB");
  }
  const ext = extname(file.name).toLowerCase();
  const typeOk = ALLOWED_TYPES.has(file.type);
  const extOk = ALLOWED_EXTS.has(ext) || ext === "";
  if (!typeOk && !extOk) {
    throw new Error("Usa una imagen JPG, PNG, WebP o GIF");
  }
}

export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0] ?? "");
}

export async function ensurePhotoBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`No se pudo listar buckets de Storage: ${error.message}`);
  if (data?.some((b) => b.id === PHOTO_BUCKET || b.name === PHOTO_BUCKET)) return;
  const created = await supabase.storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_PHOTO_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(`No se pudo crear el bucket ${PHOTO_BUCKET}: ${created.error.message}`);
  }
}

async function storeLocal(dishId: string, file: File): Promise<string> {
  const ext = photoExtension(file.name, file.type);
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = `${dishId}-${Date.now()}${ext}`;
  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${filename}`;
}

export async function storeDishPhoto(
  dishId: string,
  file: File,
  previousUrl?: string | null,
): Promise<string> {
  assertImageFile(file);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (process.env.VERCEL) {
      throw new Error(
        "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para subir fotos en Vercel.",
      );
    }
    return storeLocal(dishId, file);
  }

  await ensurePhotoBucket();
  const path = photoObjectPath(dishId, file.name, file.type);
  const body = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);

  const previousPath = previousUrl ? storagePathFromPublicUrl(previousUrl) : null;
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
