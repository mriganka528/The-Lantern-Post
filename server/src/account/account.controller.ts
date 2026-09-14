import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { RequestLimit } from '../safety/request-limits';
import { AllowDeletionAccess } from './account-access';
import { AccountService } from './account.service';
class DeleteAccountDto { @IsUUID('4') requestId!: string; @IsString() @Length(3, 24) confirmation!: string; @IsIn([true]) confirmed!: true; }
@Controller('account') @UseGuards(ClerkAuthGuard)
export class AccountController {
  constructor(private accounts: AccountService) {}
  @Get('status') @Header('Cache-Control', 'no-store') @AllowDeletionAccess()
  status(@CurrentIdentity() identity: AuthIdentity) { return this.accounts.status(identity.subject); }
  @Post('delete') @HttpCode(200) @Header('Cache-Control', 'no-store') @AllowDeletionAccess() @RequestLimit('account-delete', 3, 3600000)
  remove(@CurrentIdentity() identity: AuthIdentity, @Body() input: DeleteAccountDto) { return this.accounts.request(identity.subject, input.requestId, input.confirmation); }
}
