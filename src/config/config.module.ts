import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';

const appEnv = process.env.APP_ENV || 'local';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: [`.env.${appEnv}`, '.env'],
      cache: true,
    }),
  ],
})
export class ConfigModule {}
