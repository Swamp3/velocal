import { Controller, Get, Header } from '@nestjs/common';

import { ChangelogEntry, ChangelogService } from './changelog.service';

@Controller('changelog')
export class ChangelogController {
  constructor(private readonly changelog: ChangelogService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  getChangelog(): ChangelogEntry[] {
    return this.changelog.getEntries();
  }
}
