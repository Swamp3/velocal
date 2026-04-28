import { SetMetadata } from '@nestjs/common';

export const BAD_WORD_FIELDS_KEY = 'bad_word_fields';

export const CheckBadWords = (...fields: string[]) =>
  SetMetadata(BAD_WORD_FIELDS_KEY, fields);
