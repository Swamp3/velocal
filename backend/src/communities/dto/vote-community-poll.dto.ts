import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';

export class VoteCommunityPollDto {
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  optionIds: string[];
}
