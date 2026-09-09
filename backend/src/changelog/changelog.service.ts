import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

/**
 * Where the root CHANGELOG.md ends up depends on how the app is run:
 * - Docker image: the build copies it in next to the compiled app as
 *   `root-CHANGELOG.md` (named distinctly from backend's own CHANGELOG.md,
 *   which also ships in the image — see backend/Dockerfile).
 * - Local `nest start` from the backend/ folder: nothing copies it, so we
 *   just reach up to the real repo-root CHANGELOG.md on disk.
 * Whichever exists first wins.
 */
const CANDIDATE_PATHS = [
  join(__dirname, '..', '..', 'root-CHANGELOG.md'),
  join(__dirname, '..', '..', '..', 'CHANGELOG.md'),
];

const VERSION_HEADING = /^##\s+\[([^\]]+)\]\s*(?:[-—]\s*(\d{4}-\d{2}-\d{2}))?/;
const SECTION_HEADING = /^###\s+(.+)/;
const BULLET = /^-\s+(.+)/;

@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);

  getEntries(): ChangelogEntry[] {
    const raw = this.readFile();
    if (raw === null) return [];
    return this.parse(raw);
  }

  private readFile(): string | null {
    const path = CANDIDATE_PATHS.find(existsSync);
    if (!path) {
      this.logger.warn(
        `CHANGELOG.md not found in any candidate path: ${CANDIDATE_PATHS.join(', ')}`,
      );
      return null;
    }
    return readFileSync(path, 'utf-8');
  }

  private parse(raw: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    let currentEntry: ChangelogEntry | null = null;
    let currentSection: ChangelogSection | null = null;

    for (const line of raw.split('\n')) {
      const versionMatch = VERSION_HEADING.exec(line);
      if (versionMatch) {
        currentEntry = {
          version: versionMatch[1],
          date: versionMatch[2] ?? null,
          sections: [],
        };
        entries.push(currentEntry);
        currentSection = null;
        continue;
      }

      const sectionMatch = currentEntry ? SECTION_HEADING.exec(line) : null;
      if (sectionMatch) {
        currentSection = { title: sectionMatch[1].trim(), items: [] };
        currentEntry!.sections.push(currentSection);
        continue;
      }

      const bulletMatch = currentSection ? BULLET.exec(line) : null;
      if (bulletMatch) {
        currentSection!.items.push(bulletMatch[1].trim());
      }
    }

    return entries;
  }
}
