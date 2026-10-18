import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PUSH_CATEGORIES } from '../push-messages';
import { PushPreferencesDto } from './push.dto';

describe('PushPreferencesDto', () => {
  // The API strips unknown fields, so a category missing here can never be saved.
  it.each(PUSH_CATEGORIES)('accepts and keeps the %s category', (category) => {
    const dto = plainToInstance(PushPreferencesDto, { [category]: true });
    expect(validateSync(dto, { whitelist: true })).toHaveLength(0);
    expect(dto).toEqual({ [category]: true });
  });
});
