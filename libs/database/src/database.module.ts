import { Module } from '@nestjs/common';

import { ConfigModule } from 'src/config/config.module';
import { DatabaseService } from './database.service';
import { PrismaService } from './prisma.service';
import {
  CapePasswordSetupTokenRepository,
  CapeRoleRepository,
  CapeUserProfileRepository,
  CapeUserProfileV2Repository,
  CapeUserRepository,
  LearnworldsProgram,
  LearnworldsUserEnrollmentRepository,
  RefreshTokenRepository,
} from './repository';
import { LearnWorldsUserEnrollmentProgramRepo } from './repository/learnworlds-user-enrollment-program.repo';

@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseService,
    PrismaService,

    // repositories (providers)
    CapeUserRepository,
    RefreshTokenRepository,
    CapeRoleRepository,
    CapeUserProfileRepository,
    CapePasswordSetupTokenRepository,
    LearnworldsUserEnrollmentRepository,
    LearnworldsProgram,
    LearnWorldsUserEnrollmentProgramRepo,
    CapeUserProfileV2Repository,
  ],
  exports: [
    DatabaseService,
    PrismaService,

    // export repos so other modules can inject them
    CapeUserRepository,
    RefreshTokenRepository,
    CapeRoleRepository,
    CapeUserProfileRepository,
    CapePasswordSetupTokenRepository,
    LearnworldsUserEnrollmentRepository,
    LearnworldsProgram,
    LearnWorldsUserEnrollmentProgramRepo,
    CapeUserProfileV2Repository,
  ],
})
export class DatabaseModule {}
