import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse, ReadinessResponse } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { HealthResponseDto, ReadinessResponseDto } from './health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'API process liveness' })
  @ApiOkResponse({ type: HealthResponseDto, description: 'The API process is running.' })
  health(): HealthResponse {
    return { status: 'ok', service: 'lantern-post-api' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'API database readiness' })
  @ApiOkResponse({ type: ReadinessResponseDto, description: 'PostgreSQL accepts queries.' })
  @ApiServiceUnavailableResponse({ type: ReadinessResponseDto, description: 'PostgreSQL is unavailable; no internal error details are exposed.' })
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'lantern-post-api', checks: { database: 'up' } };
    } catch {
      const response: ReadinessResponse = { status: 'error', service: 'lantern-post-api', checks: { database: 'down' } };
      throw new ServiceUnavailableException(response);
    }
  }
}
