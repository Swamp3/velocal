import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';

/**
 * Serves re-encoded image variants from `/app/uploads`. This is the only way
 * client code ever touches user-uploaded content — `UploadsService` writes the
 * on-disk files, we stream them back here. Caddy → frontend SSR → `/api/*`
 * proxy already routes us, so no extra server-level wiring is needed.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Get(':subject/:id/:variant')
  serve(
    @Param('subject') subject: string,
    @Param('id') id: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ): void {
    const path = this.uploads.resolveFile(subject, id, variant);
    if (!path) {
      throw new NotFoundException('Image not found');
    }

    // Variants are immutable — the URL carries a `?v=` cache-buster when the
    // underlying file is replaced, so we can safely cache forever downstream.
    res.setHeader('Content-Type', this.uploads.contentTypeFor(variant));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    this.uploads.stream(path).pipe(res);
  }
}
