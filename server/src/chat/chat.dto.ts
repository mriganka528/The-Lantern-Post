import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import type { ChatSendRequest, LetterReportReason } from '@lantern-post/shared-types';
export class ChatPeerDto { @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) peerId!: string; }
export class ChatRequestDto extends ChatPeerDto { @IsUUID('4') requestId!: string; }
export class ChatMessageDto { @IsString() @Matches(/^chatmsg_[a-f0-9-]{36}$/) messageId!: string; }
export class ChatHistoryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) before?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) after?: number;
}
export class ChatPollDto { @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) after = 0; }
export class ChatSendDto implements ChatSendRequest {
  @IsUUID('4') requestId!: string;
  @Transform(({ value }: TransformFnParams) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 2000) text!: string;
  @IsIn([true]) confirmed!: true;
}
export class ChatConfirmDto { @IsIn([true]) confirmed!: true; }
export class ChatReportDto extends ChatConfirmDto {
  @IsIn(['HARASSMENT', 'SPAM', 'HATE_SPEECH', 'SELF_HARM_CONCERN', 'OTHER']) reason!: LetterReportReason;
  @IsOptional() @Transform(({ value }: TransformFnParams) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(500) detail?: string;
  @IsBoolean() blockSender!: boolean;
}
