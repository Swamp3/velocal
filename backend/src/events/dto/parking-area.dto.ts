import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PARKING_FEES,
  PARKING_KINDS,
  type ParkingFee,
  type ParkingKind,
} from '../parking';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

class ParkingPointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

/** A parking area as entered in the event form. */
export class ParkingAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(PARKING_KINDS, { each: true })
  kinds: ParkingKind[];

  @ValidateNested()
  @Type(() => ParkingPointDto)
  coordinates: ParkingPointDto;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number | null;

  @IsOptional()
  @IsIn([...PARKING_FEES, null])
  fee?: ParkingFee | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  feeNote?: string | null;

  @IsOptional()
  @Matches(TIME)
  openFrom?: string | null;

  @IsOptional()
  @Matches(TIME)
  openUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}
