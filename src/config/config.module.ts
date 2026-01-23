import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`],
      cache: true,
    }),
  ],
})
export class ConfigModule {}
