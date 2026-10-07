import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB
export const PHOTO_DIR = resolve(process.cwd(), 'uploads', 'students');

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Checks the file's real content, not just its name/extension. */
function detectImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

export function assertValidPhoto(file: Express.Multer.File): string {
  if (!MIME_EXT[file.mimetype]) {
    throw new BadRequestException('Photo must be a JPG, JPEG, PNG or WebP image');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new BadRequestException('Photo must be 2 MB or smaller');
  }
  const ext = detectImageType(file.buffer);
  if (!ext) throw new BadRequestException('The uploaded file is not a valid image');
  return ext;
}

/** Saves a validated photo and returns its stored file name. */
export async function savePhoto(file: Express.Multer.File): Promise<string> {
  const ext = assertValidPhoto(file);
  await mkdir(PHOTO_DIR, { recursive: true });
  const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
  await writeFile(join(PHOTO_DIR, name), file.buffer);
  return name;
}

export async function deletePhoto(name?: string | null): Promise<void> {
  if (!name || name.includes('/') || name.includes('\\')) return;
  await unlink(join(PHOTO_DIR, name)).catch(() => undefined);
}

export function photoPath(name: string): string | null {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return join(PHOTO_DIR, name);
}
