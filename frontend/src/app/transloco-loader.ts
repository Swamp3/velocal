import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { from } from 'rxjs';

/**
 * Dynamic-import loader. Each language JSON becomes its own lazy chunk, keeping
 * the initial bundle small (the files are ~25 kB each, so statically importing
 * both was blowing the initial budget).
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    const chunk =
      lang === 'en'
        ? import('../assets/i18n/en.json')
        : import('../assets/i18n/de.json');
    return from(
      chunk
        .then((m) => ((m as { default?: Translation }).default ?? (m as Translation)) as Translation)
        .catch(() => ({}) as Translation),
    );
  }
}
