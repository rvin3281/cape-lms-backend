/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { AzureTestRow } from '@app/shared';
import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { AzureRedisTestService } from './azure-redis-test-service.service';

@Controller('azure-redis-test')
export class AzureRedisTestController {
  constructor(private readonly service: AzureRedisTestService) {}

  // Upload Excel (xlsx)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

    // Expect columns: externalId, email, fullName
    const payload: AzureTestRow[] = rows.map((r) => ({
      externalId: String(
        r.externalId ?? r.ExternalId ?? r.EXTERNAL_ID ?? '',
      ).trim(),
      email: String(r.email ?? r.Email ?? '').trim() || undefined,
      fullName: String(r.fullName ?? r.FullName ?? '').trim() || undefined,
    }));

    return this.service.enqueueBulk(payload);
  }

  // Quick manual trigger without excel (postman)
  @Post('seed')
  async seed() {
    const payload: AzureTestRow[] = Array.from({ length: 20 }).map((_, i) => ({
      externalId: `TEST-${String(i + 1).padStart(3, '0')}`,
      email: `test${i + 1}@example.com`,
      fullName: `Test User ${i + 1}`,
    }));
    return this.service.enqueueBulk(payload);
  }

  // Verify latest DB results
  @Get('latest')
  async latest() {
    return this.service.getLatest(50);
  }

  // Verify specific externalId
  @Get(':externalId')
  async one(@Param('externalId') externalId: string) {
    return this.service.getByExternalId(externalId);
  }
}
