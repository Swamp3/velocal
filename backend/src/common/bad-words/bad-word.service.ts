import { Injectable, Logger } from '@nestjs/common';
import { Profanity } from '@2toad/profanity';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface BadWordViolation {
  field: string;
}

export interface BadWordCheckResult {
  clean: boolean;
  violations: BadWordViolation[];
}

@Injectable()
export class BadWordService {
  private readonly logger = new Logger(BadWordService.name);
  private readonly profanity: Profanity;

  constructor() {
    this.profanity = new Profanity({
      languages: ['de', 'en'],
      wholeWord: true,
    });

    this.loadCustomWords();
  }

  checkFields(
    data: Record<string, unknown>,
    fields: string[],
  ): BadWordCheckResult {
    const violations: BadWordViolation[] = [];

    for (const field of fields) {
      const value = data[field];
      if (typeof value !== 'string' || !value) continue;

      const normalized = this.normalize(value);
      if (this.profanity.exists(normalized)) {
        this.logger.warn(`Bad word detected in field "${field}"`);
        violations.push({ field });
      }
    }

    return { clean: violations.length === 0, violations };
  }

  /** Strip zero-width chars and normalize whitespace before checking */
  private normalize(text: string): string {
    return text
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Load extra words/phrases from blocklist.json on top of built-in lists */
  private loadCustomWords(): void {
    try {
      const raw = readFileSync(join(__dirname, 'blocklist.json'), 'utf-8');
      const list: { words: string[]; phrases: string[] } = JSON.parse(raw);
      const custom = [...list.words, ...list.phrases];

      if (custom.length) {
        this.profanity.addWords(custom);
        this.logger.log(`Added ${custom.length} custom words/phrases`);
      }
    } catch {
      this.logger.warn('No custom blocklist.json found, using built-in lists only');
    }
  }
}
