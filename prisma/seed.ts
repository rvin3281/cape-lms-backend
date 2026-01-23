import 'dotenv/config';
import { PrismaClient } from 'src/generated/client';

// Driver adapter
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
      level: 'super admin',
      roleCode: 'SUPER_ADMIN',
      createdBy: 'seed',
    },
  });

  const adminRole = await prisma.capeRole.upsert({
    where: { roleName: 'Admin' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'Admin',
      level: 'admin',
      roleCode: 'ADMIN',
      createdBy: 'seed',
    },
  });

  const hrFocalRole = await prisma.capeRole.upsert({
    where: { roleName: 'HR_FOCAL_ADMIN' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'HR Focal Admin',
      level: 'hr focal admin',
      roleCode: 'HR_FOCAL_ADMIN',
      createdBy: 'seed',
    },
  });

  const userRole = await prisma.capeRole.upsert({
    where: { roleName: 'User' }, // you requested exactly "admin"
    update: {},
    create: {
      roleName: 'User',
      level: 'user',
      roleCode: 'USER',
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
      where: { email },
      update: {
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
    email: 'learner@gmail.com',
    firstName: 'Arif',
    lastName: 'Hakim',
    userName: 'arif.hakim',
    companyName: null,
    roleId: userRole.roleId,
    isAdmin: false,
  });

  // =========================
  // 3) Learner Profiles (only for role = User)
  // =========================

  // Find all users with role "User"
  const learnerUsers = await prisma.capeUser.findMany({
    where: {
      roleId: userRole.roleId, // ✅ only users with "User" role
    },
    select: {
      userId: true, // ✅ this is what capeLearnerProfiles.userId references
    },
  });

  // Upsert profile for each learner user (idempotent)
  for (const u of learnerUsers) {
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
    `✅ Learner profiles ensured for ${learnerUsers.length} User-role users`,
  );

  console.log('✅ Seed complete:', {
    roles: [
      superAdminRole.roleName,
      adminRole.roleName,
      hrFocalRole.roleName,
      userRole.roleName,
    ],
    users: [
      'super-admin@utp.edu.my',
      'admin@utp.edu.my',
      'hr-focal@petronas.com',
      'learner@gmail.com',
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
