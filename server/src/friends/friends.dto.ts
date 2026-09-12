import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { FriendsView, RespondFriendRequest } from '@lantern-post/shared-types';
import { UsernameQueryDto } from '../users/users.dto';

export class FriendSearchDto extends UsernameQueryDto {}
export class SendFriendDto extends UsernameQueryDto {}
export class FriendListDto {
  @ApiPropertyOptional({ enum: ['friends', 'incoming', 'outgoing'], default: 'friends' })
  @IsOptional() @IsIn(['friends', 'incoming', 'outgoing']) view: FriendsView = 'friends';

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional() @IsString() @Length(1, 256) @Matches(/^[A-Za-z0-9_-]+$/) cursor?: string;
}
export class FriendIdDto {
  @ApiProperty({ maxLength: 100 })
  @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) id!: string;
}
export class RespondFriendDto implements RespondFriendRequest {
  @ApiProperty({ enum: ['accept', 'decline'] })
  @IsIn(['accept', 'decline']) action!: 'accept' | 'decline';
}
export class PushTokenDto {
  @ApiProperty({ description: 'Expo token issued to this installation. Never returned by the API.' })
  @Transform(({ value }: TransformFnParams) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(20, 250) @Matches(/^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]+\]$/) token!: string;
}
export class RegisterPushDto extends PushTokenDto {
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}
