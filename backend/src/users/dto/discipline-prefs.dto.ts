import { ArrayNotEmpty, IsString } from 'class-validator';

export class DisciplinePrefsDto {
  @ArrayNotEmpty()
  @IsString({ each: true })
  disciplineSlugs: string[];
}
