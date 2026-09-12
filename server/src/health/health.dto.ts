import { ApiProperty } from '@nestjs/swagger';
import type { HealthResponse, ReadinessResponse } from '@lantern-post/shared-types';

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ enum: ['lantern-post-api'] })
  service!: 'lantern-post-api';
}

export class ReadinessResponseDto implements ReadinessResponse {
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ enum: ['lantern-post-api'] })
  service!: 'lantern-post-api';

  @ApiProperty({
    type: 'object',
    properties: { database: { type: 'string', enum: ['up', 'down'] } },
    required: ['database'],
  })
  checks!: { database: 'up' | 'down' };
}
