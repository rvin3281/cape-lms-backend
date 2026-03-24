import 'dotenv/config';
import { PrismaClient } from 'src/generated/client';

// Driver adapter
import { ROLE_CODE } from '@app/shared';
import { PrismaMssql } from '@prisma/adapter-mssql';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing');

const adapter = new PrismaMssql(url); // ✅ pass STRING directly
const prisma = new PrismaClient({ adapter });

// ✅ hash for abc123456 (keep exactly same for all seeded users)
const PASSWORD_HASH =
  '$2b$12$IBppY2e8mEk6l5CCx26uCeYyyZQIuDpg/kyCl2OEu.2W26dZnZ98a';

async function main() {
  // 1) Upsert roles (safe to run many times)
  const superAdminRole = await prisma.capeRole.upsert({
    where: { roleName: 'Super Admin' }, // roleName is unique ✅
    update: {}, // keep as-is if already exists
    create: {
      roleName: 'Super Admin',
      level: 'super_admin',
      roleCode: 'SUPER_ADMIN',
      createdBy: 'seed',
    },
  });

  const adminRole = await prisma.capeRole.upsert({
    where: { roleName: 'CAPE Admin' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'CAPE Admin',
      level: 'admin',
      roleCode: ROLE_CODE.CAPE_ADMIN,
      createdBy: 'seed',
    },
  });

  const hrFocalRole = await prisma.capeRole.upsert({
    where: { roleName: 'HR Focal Admin' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'HR Focal Admin',
      level: 'admin',
      roleCode: ROLE_CODE.HR_FOCAL_ADMIN,
      createdBy: 'seed',
    },
  });

  const individualLearner = await prisma.capeRole.upsert({
    where: { roleName: 'Individual Learner' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'Individual Learner',
      level: 'user',
      roleCode: ROLE_CODE.INDIVIDUAL_LEARNER,
      createdBy: 'seed',
    },
  });

  const hybridLearner = await prisma.capeRole.upsert({
    where: { roleName: 'Hybrid Learner' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'Hybrid Learner',
      level: 'user',
      roleCode: ROLE_CODE.HYBRID_LEARNER,
      createdBy: 'seed',
    },
  });

  const classroomLearner = await prisma.capeRole.upsert({
    where: { roleName: 'Classroom Learner' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'Classroom Learner',
      level: 'user',
      roleCode: ROLE_CODE.CLASSROOM_LEARNER,
      createdBy: 'seed',
    },
  });

  // helper for consistent upsert
  const upsertUser = async (args: {
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    companyName?: string | null;
    roleId: string;
    isAdmin?: boolean;
    isActive?: boolean;
    learnworldId?: string | null;
  }) => {
    const {
      email,
      firstName,
      lastName,
      userName,
      roleId,
      isAdmin = false,
      isActive = true,
      learnworldId = null,
    } = args;

    return prisma.capeUser.upsert({
      where: { userName },
      update: {
        email,
        firstName,
        lastName,
        userName,
        learnworldId,
        passwordHash: PASSWORD_HASH,
        roleId,
        isAdmin,
        isActive,
        updatedBy: 'seed',
      },
      create: {
        email,
        firstName,
        lastName,
        userName,
        learnworldId,
        passwordHash: PASSWORD_HASH,
        roleId,
        isAdmin,
        isActive,
        createdBy: 'seed',
      },
    });
  };

  // =========================
  // 2) Users (idempotent)
  // =========================

  // CAPE Super Admin (internal)
  await upsertUser({
    email: 'super-admin@utp.edu.my',
    firstName: 'Nur',
    lastName: 'Aisyah',
    userName: 'nur.aisyah.superadmin',
    companyName: 'UTP CAPE',
    roleId: superAdminRole.roleId,
    isAdmin: true,
  });

  // CAPE Admin (internal)
  await upsertUser({
    email: 'admin@utp.edu.my',
    firstName: 'Muhammad',
    lastName: 'Haziq',
    userName: 'muhammad.haziq.admin',
    companyName: 'UTP CAPE',
    roleId: adminRole.roleId,
    isAdmin: true,
  });

  // HR Focal Admin (enterprise)
  await upsertUser({
    email: 'hr-focal@petronas.com',
    firstName: 'Siti',
    lastName: 'Nurul',
    userName: 'siti.nurul.hrfocal',
    companyName: 'PETRONAS',
    roleId: hrFocalRole.roleId, // ✅ correct role
    isAdmin: true,
  });

  // Individual Learner (self sign-up)
  await upsertUser({
    email: 'individual_learner@gmail.com',
    firstName: 'Arif',
    lastName: 'Hakim',
    userName: 'arif.hakim',
    companyName: null,
    roleId: individualLearner.roleId,
    isAdmin: false,
  });

  await upsertUser({
    email: 'hybrid_learner@gmail.com',
    firstName: 'Hybrid',
    lastName: 'Learner',
    userName: 'hybrid.learner',
    companyName: null,
    roleId: hybridLearner.roleId,
    isAdmin: false,
  });

  await upsertUser({
    email: 'classroom_learner@gmail.com',
    firstName: 'Classroom',
    lastName: 'Learner',
    userName: 'classroom.learner',
    companyName: null,
    roleId: classroomLearner.roleId,
    isAdmin: false,
  });

  // =========================
  // 3) Learner Profiles (only for role = User)
  // =========================

  // Find all users with role "User"
  const hybridUsers = await prisma.capeUser.findMany({
    where: {
      roleId: hybridLearner.roleId, // ✅ only users with "User" role
    },
    select: {
      userId: true, // ✅ this is what capeLearnerProfiles.userId references
    },
  });

  // Upsert profile for each learner user (idempotent)
  for (const u of hybridUsers) {
    await prisma.capeLearnerProfiles.upsert({
      where: { userId: u.userId }, // userId is unique in profile ✅
      update: {
        // keep all optional fields null, but still touch updatedAt via Prisma @updatedAt
        bio: null,
        location: null,
        url: null,
        fb: null,
        twitter: null,
        instagram: null,
        linkedin: null,
        skype: null,
        behance: null,
        dribbble: null,
        github: null,
        cfCompany: null,
        cfCohort: null,
        npsScore: null,
        npsComment: null,
        tags: null,
      },
      create: {
        userId: u.userId,
        bio: null,
        location: null,
        url: null,
        fb: null,
        twitter: null,
        instagram: null,
        linkedin: null,
        skype: null,
        behance: null,
        dribbble: null,
        github: null,
        cfCompany: null,
        cfCohort: null,
        npsScore: null,
        npsComment: null,
        tags: null,
      },
    });
  }

  console.log(
    `Hybrid Learner profiles ensured for ${hybridUsers.length} User-role users`,
  );

  console.log('✅ Seed complete:', {
    roles: [
      superAdminRole.roleName,
      adminRole.roleName,
      hrFocalRole.roleName,
      individualLearner.roleName,
      hybridLearner.roleName,
      classroomLearner.roleName,
    ],
    users: [
      'super-admin@utp.edu.my',
      'admin@utp.edu.my',
      'hr-focal@petronas.com',
      'individual_learner@gmail.com',
      'hybrid_learner@gmail.com',
      'classroom_learner@gmail.com',
      'enterprise-learner@petronas.com',
    ],
    defaultPassword: 'abc123456',
  });
}

main()
  .catch((e) => {
    console.log(process.env.DATABASE_URL);
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
