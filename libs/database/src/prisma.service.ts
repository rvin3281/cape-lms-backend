import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from 'src/generated/client';

interface AppConfig {
  database: DatabaseConfig;
}

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  trustServerCertificate: boolean;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService<AppConfig>) {
    const dbConfig = configService.get<DatabaseConfig>('database');

    if (!dbConfig) {
      throw new Error('Database configuration is missing (config.database).');
    }

    const adapter = new PrismaMssql({
      server: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name,
      options: {
        encrypt: true,
        trustServerCertificate: dbConfig.trustServerCertificate,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
