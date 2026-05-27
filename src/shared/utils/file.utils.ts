export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: Express.Multer.File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new Error(
      `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
}

export function generateStoragePath(module: string, entityId: string): string {
  return `${module}/${entityId}`;
}
