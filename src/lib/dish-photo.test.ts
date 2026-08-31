import { describe, expect, it } from "vitest";
import {
  assertImageFile,
  photoExtension,
  photoObjectPath,
  storagePathFromPublicUrl,
} from "./dish-photo";

describe("photoExtension", () => {
  it("normalizes jpeg to jpg", () => {
    expect(photoExtension("foto.JPEG")).toBe(".jpg");
  });

  it("keeps png and webp", () => {
    expect(photoExtension("a.png")).toBe(".png");
    expect(photoExtension("a.webp")).toBe(".webp");
  });

  it("falls back to mime when the name has no extension", () => {
    expect(photoExtension("blob", "image/webp")).toBe(".webp");
    expect(photoExtension("blob", "image/png")).toBe(".png");
  });
});

describe("photoObjectPath", () => {
  it("nests the file under a sanitized dish id", () => {
    expect(photoObjectPath("pollo-guisado", "x.jpg", "image/jpeg", 1700000000000)).toBe(
      "pollo-guisado/1700000000000.jpg",
    );
  });

  it("strips unsafe characters from the dish id", () => {
    expect(photoObjectPath("../hack id!", "x.png", undefined, 1)).toBe("hackid/1.png");
  });
});

describe("assertImageFile", () => {
  it("rejects empty files", () => {
    expect(() =>
      assertImageFile({ name: "a.jpg", type: "image/jpeg", size: 0 }),
    ).toThrow(/imagen/i);
  });

  it("rejects files over 8 MB", () => {
    expect(() =>
      assertImageFile({
        name: "a.jpg",
        type: "image/jpeg",
        size: 9 * 1024 * 1024,
      }),
    ).toThrow(/8 MB/);
  });

  it("rejects non-images", () => {
    expect(() =>
      assertImageFile({ name: "notas.pdf", type: "application/pdf", size: 100 }),
    ).toThrow(/JPG/);
  });

  it("accepts a jpeg under the size limit", () => {
    expect(() =>
      assertImageFile({ name: "plato.jpg", type: "image/jpeg", size: 1200 }),
    ).not.toThrow();
  });
});

describe("storagePathFromPublicUrl", () => {
  it("extracts the object path from a public Storage URL", () => {
    const url =
      "https://abc.supabase.co/storage/v1/object/public/platos/pollo-guisado/1.jpg";
    expect(storagePathFromPublicUrl(url)).toBe("pollo-guisado/1.jpg");
  });

  it("returns null for local or placeholder paths", () => {
    expect(storagePathFromPublicUrl("/uploads/x.jpg")).toBeNull();
    expect(storagePathFromPublicUrl("/images/placeholders/cortes.svg")).toBeNull();
  });
});
