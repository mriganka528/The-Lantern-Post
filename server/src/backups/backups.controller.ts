import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { ServerResponse } from 'node:http';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { RequestLimit } from '../safety/request-limits';
import { DriveService } from './drive.service';
import { BackupsService } from './backups.service';
class PageQuery {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) peerId!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) through!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) before!: number;
}
class FileParam { @IsString() @Matches(/^[a-zA-Z0-9_-]{1,200}$/) id!: string; }
class LinkParam { @IsUUID() id!: string; }
class EnvelopeDto {
  @IsString() @Matches(/^lantern-(chat|voice)-backup$/) format!: string;
  @IsInt() @Min(1) @Max(1) version!: number;
  @IsString() @Matches(/^AES-256-GCM$/) algorithm!: string;
  @IsString() @MaxLength(14 * 1024 * 1024) data!: string;
}
@Controller('backups') @UseGuards(ClerkAuthGuard)
export class BackupsController {
  constructor(private drive: DriveService, private backups: BackupsService) {}
  @Get('manifest') @Header('Cache-Control','no-store') @RequestLimit('backup-read',30)
  manifest(@CurrentIdentity() i: AuthIdentity) { return this.backups.manifest(i.subject); }
  @Get('page') @Header('Cache-Control','no-store') @RequestLimit('backup-pages',120)
  page(@CurrentIdentity() i: AuthIdentity, @Query() q: PageQuery) { return this.backups.page(i.subject,q.peerId,q.through,q.before); }
  @Get('drive') @Header('Cache-Control','no-store')
  status(@CurrentIdentity() i: AuthIdentity) { return this.drive.status(i.subject); }
  @Post('drive/connect') @HttpCode(200) @RequestLimit('drive-connect',10)
  connect(@CurrentIdentity() i: AuthIdentity) { return this.drive.begin(i.subject); }
  @Get('drive/links/:id') @Header('Cache-Control','no-store') @RequestLimit('drive-link',90)
  link(@CurrentIdentity() i: AuthIdentity,@Param() p: LinkParam) { return this.drive.linkStatus(i.subject,p.id); }
  @Get('drive/files') @Header('Cache-Control','no-store') @RequestLimit('drive-list',30)
  files(@CurrentIdentity() i: AuthIdentity) { return this.drive.list(i.subject); }
  @Post('drive/files') @HttpCode(200) @RequestLimit('drive-upload',10)
  upload(@CurrentIdentity() i: AuthIdentity,@Body() body: EnvelopeDto) { return this.drive.upload(i.subject,body); }
  @Get('drive/files/:id') @Header('Cache-Control','no-store') @RequestLimit('drive-download',30)
  download(@CurrentIdentity() i: AuthIdentity,@Param() p: FileParam) { return this.drive.download(i.subject,p.id); }
  @Post('drive/files/:id/remove') @HttpCode(200) @RequestLimit('drive-remove',30)
  remove(@CurrentIdentity() i: AuthIdentity,@Param() p: FileParam) { return this.drive.remove(i.subject,p.id); }
  @Post('drive/disconnect') @HttpCode(200) @RequestLimit('drive-disconnect',10)
  disconnect(@CurrentIdentity() i: AuthIdentity) { return this.drive.disconnect(i.subject); }
}
@Controller('backups/drive')
export class DriveCallbackController {
  constructor(private drive: DriveService) {}
  @Get('callback')
  async callback(@Query('state') state: unknown,@Query('code') code: unknown,@Res() res: ServerResponse) {
    let ok = false;
    try { if (typeof state === 'string' && state.length <= 100 && typeof code === 'string' && code.length <= 4096) { await this.drive.callback(state,code); ok = true; } } catch { /* Never echo OAuth secrets or provider errors. */ }
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    res.statusCode = ok ? 200 : 400; res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Lantern Post · Google Drive</title><body style="background:#faf4e8;color:#514933;font:20px Georgia;padding:10%;text-align:center"><h1>'+ (ok ? 'Your archive has a home.' : 'The connection could not be completed.') +'</h1>'+ (ok ? '<p><a href="lantern-post://privacy" style="display:inline-block;padding:14px 20px;background:#465448;color:#fff8e9;border-radius:6px;text-decoration:none">Return to the app</a></p>' : '') +'<p>On a computer, return to your Lantern Post tab. You may close this window.</p></body></html>');
  }
}
