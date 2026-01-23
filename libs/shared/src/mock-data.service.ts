/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class MockDataService {
  private cache = new Map<string, any>();

  async getJson<T = any>(relativePath: string): Promise<T> {
    if (this.cache.has(relativePath)) return this.cache.get(relativePath);

    const absPath = join(process.cwd(), relativePath);
    const raw = await readFile(absPath, 'utf-8');
    const parsed = JSON.parse(raw);

    this.cache.set(relativePath, parsed);
    return parsed;
  }
}
