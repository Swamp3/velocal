import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ImageAccessService } from './image-access.service';
import { UploadsService } from './uploads.service';

/**
 * Serves re-encoded image variants from `/app/uploads`. This is the only way
 * client code ever touches user-uploaded content — `UploadsService` writes the
 * on-disk files, we stream them back here. Caddy → frontend SSR → `/api/*`
 * proxy already routes us, so no extra server-level wiring is needed.
 */
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly imageAccess: ImageAccessService,
  ) {}

  @Get(':subject/:id/:variant')
  async serve(
    @Param('subject') subject: string,
    @Param('id') id: string,
    @Param('variant') variant: string,
    @Query('access') access: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const path = this.uploads.resolveFile(subject, id, variant);
    if (!path) {
      throw new NotFoundException('Image not found');
    }

    const restriction = await this.imageAccess.restriction(subject, id);
    if (restriction === 'hidden') {
      throw new NotFoundException('Image not found');
    }
    if (
      restriction === 'signed' &&
      !this.imageAccess.matches(subject, id, access)
    ) {
      throw new NotFoundException('Image not found');
    }

    // Public variants are immutable — the URL carries a `?v=` cache-buster when
    // the file is replaced. Restricted images stay out of shared caches.
    res.setHeader('Content-Type', this.uploads.contentTypeFor(variant));
    res.setHeader(
      'Cache-Control',
      restriction === 'signed'
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
    );
    this.uploads.stream(path).pipe(res);
  }
}
