import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

export type UploadSubject = 'events' | 'series' | 'posts';

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

interface VariantSpec {
  filename: string;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
  quality: number;
}

/**
 * Every uploaded image is re-encoded into this fixed set of variants. We never
 * serve the original file back — that strips EXIF, rejects any SVG/HTML
 * disguised as an image, and keeps download sizes bounded. `og.jpg` is kept
 * lossy JPEG because some social-card scrapers still don't fetch WebP.
 */
const VARIANTS: VariantSpec[] = [
  { filename: 'hero.webp', width: 1600, height: 900, format: 'webp', quality: 82 },
  { filename: 'og.jpg', width: 1200, height: 630, format: 'jpeg', quality: 82 },
  { filename: 'thumb.webp', width: 400, height: 225, format: 'webp', quality: 80 },
];

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_VARIANT = 'hero.webp';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly rootDir: string;

  constructor() {
    this.rootDir = resolve(process.env.UPLOADS_DIR ?? '/app/uploads');
  }

  /**
   * Re-encodes `file` into all variants under `{root}/{subject}/{id}/`.
   * Returns the public URL (including a cache-busting `v` query arg) of the
   * canonical hero variant, which is what the caller should store on the
   * entity.
   */
  async save(subject: UploadSubject, id: string, file: UploadedFile): Promise<string> {
    this.validate(file);

    const dir = this.subjectDir(subject, id);
    await mkdir(dir, { recursive: true });

    const pipeline = sharp(file.buffer, { failOn: 'error' }).rotate();
    try {
      await Promise.all(
        VARIANTS.map((v) =>
          pipeline
            .clone()
            .resize(v.width, v.height, { fit: 'cover', position: 'attention' })
            .toFormat(v.format, { quality: v.quality })
            .toFile(join(dir, v.filename)),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to process upload for ${subject}/${id}`, err as Error);
      throw new BadRequestException('Unable to process image');
    }

    return this.publicUrl(subject, id, DEFAULT_VARIANT);
  }

  /** Deletes every variant for a subject. Silently ignores a missing directory. */
  async remove(subject: UploadSubject, id: string): Promise<void> {
    const dir = this.subjectDir(subject, id);
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(`Failed to delete uploads for ${subject}/${id}: ${(err as Error).message}`);
    }
  }

  /**
   * Returns an absolute path to the requested variant, or `null` if either the
   * subject / variant is unknown or the file simply doesn't exist on disk.
   * Guards against `..`-style path escapes.
   */
  resolveFile(subject: string, id: string, variant: string): string | null {
    if (!this.isValidSubject(subject)) return null;
    if (!VARIANTS.some((v) => v.filename === variant)) return null;
    if (!/^[0-9a-f-]{8,}$/i.test(id)) return null;

    const candidate = resolve(this.subjectDir(subject, id), variant);
    if (!candidate.startsWith(this.rootDir)) return null;
    if (!existsSync(candidate)) return null;
    return candidate;
  }

  stream(path: string): NodeJS.ReadableStream {
    return createReadStream(path);
  }

  contentTypeFor(variant: string): string {
    return variant.endsWith('.jpg') || variant.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/webp';
  }

  /**
   * Builds the `og.jpg` URL from a stored `hero.webp` URL. Used by SEO meta so
   * link previews get JPEG regardless of what the entity stored.
   */
  ogVariantOf(heroUrl: string | null | undefined): string | null {
    if (!heroUrl) return null;
    return heroUrl.replace(/\/hero\.webp(\?|$)/, '/og.jpg$1');
  }

  private validate(file: UploadedFile): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image must be under 10 MB');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, or WebP images are allowed');
    }
  }

  private subjectDir(subject: string, id: string): string {
    if (!this.isValidSubject(subject)) {
      throw new InternalServerErrorException(`Unknown upload subject: ${subject}`);
    }
    return join(this.rootDir, subject, id);
  }

  private isValidSubject(subject: string): subject is UploadSubject {
    return subject === 'events' || subject === 'series' || subject === 'posts';
  }

  private publicUrl(subject: UploadSubject, id: string, variant: string): string {
    return `/api/uploads/${subject}/${id}/${variant}?v=${Date.now()}`;
  }
}
