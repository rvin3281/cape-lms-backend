import 'dotenv/config';
import { PrismaClient } from 'src/generated/client';
import { ROLE_CODE } from '@app/shared';
import { PrismaMssql } from '@prisma/adapter-mssql';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing');

const adapter = new PrismaMssql(url);
const prisma = new PrismaClient({ adapter });

// hash for abc123456
const PASSWORD_HASH =
  '$2b$12$IBppY2e8mEk6l5CCx26uCeYyyZQIuDpg/kyCl2OEu.2W26dZnZ98a';

async function main() {
  // =========================
  // 1) Upsert roles
  // =========================
  const superAdminRole = await prisma.capeRole.upsert({
    where: { roleName: 'CAPE Admin' },
    update: {},
    create: {
      roleName: 'CAPE Admin',
      level: 'admin',
      roleCode: ROLE_CODE.CAPE_ADMIN,
      createdBy: 'seed',
    },
  });

  const hrFocalRole = await prisma.capeRole.upsert({
    where: { roleName: 'HR Focal Admin' },
    update: {},
    create: {
      roleName: 'HR Focal Admin',
      level: 'admin',
      roleCode: ROLE_CODE.HR_FOCAL_ADMIN,
      createdBy: 'seed',
    },
  });

  const individualLearnerRole = await prisma.capeRole.upsert({
    where: { roleName: 'Individual Learner' },
    update: {},
    create: {
      roleName: 'Individual Learner',
      level: 'user',
      roleCode: ROLE_CODE.INDIVIDUAL_LEARNER,
      createdBy: 'seed',
    },
  });

  const hybridLearnerRole = await prisma.capeRole.upsert({
    where: { roleName: 'Hybrid Learner' },
    update: {},
    create: {
      roleName: 'Hybrid Learner',
      level: 'user',
      roleCode: ROLE_CODE.HYBRID_LEARNER,
      createdBy: 'seed',
    },
  });

  const classroomLearnerRole = await prisma.capeRole.upsert({
    where: { roleName: 'Classroom Learner' },
    update: {},
    create: {
      roleName: 'Classroom Learner',
      level: 'user',
      roleCode: ROLE_CODE.CLASSROOM_LEARNER,
      createdBy: 'seed',
    },
  });

  // =========================
  // 2) Upsert users only
  // =========================
  const upsertUser = async (args: {
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    isAdmin?: boolean;
    isActive?: boolean;
    learnworldId?: string | null;
    isFirstTimeLogin: boolean;
  }) => {
    const {
      email,
      firstName,
      lastName,
      userName,
      isAdmin = false,
      isActive = true,
      learnworldId = null,
      isFirstTimeLogin,
    } = args;

    return prisma.capeUser.upsert({
      where: { email },
      update: {
        email,
        firstName,
        lastName,
        userName,
        learnworldId,
        passwordHash: PASSWORD_HASH,
        isAdmin,
        isActive,
        isFirstTimeLogin,
        updatedBy: 'seed',
      },
      create: {
        email,
        firstName,
        lastName,
        userName,
        learnworldId,
        passwordHash: PASSWORD_HASH,
        isAdmin,
        isActive,
        isFirstTimeLogin,
        createdBy: 'seed',
      },
    });
  };

  // =========================
  // 3) Assign role to user via CapeUserRole
  // =========================
  const assignRoleToUser = async (userId: string, roleId: string) => {
    await prisma.capeUserRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      update: {
        assignedBy: 'seed',
      },
      create: {
        userId,
        roleId,
        assignedBy: 'seed',
      },
    });
  };

  // =========================
  // 4) Seed users
  // =========================
  const superAdminUser = await upsertUser({
    email: 'admin@utp.edu.my',
    firstName: 'Super',
    lastName: 'Admin',
    userName: 'superadmin',
    isAdmin: true,
    isFirstTimeLogin: false,
  });

  const hrFocalUser = await upsertUser({
    email: 'hr-focal@petronas.com',
    firstName: 'hr',
    lastName: 'focal',
    userName: 'hrfocal',
    isAdmin: true,
    isFirstTimeLogin: false,
  });

  const individualLearnerUser = await upsertUser({
    email: 'individual_learner@gmail.com',
    firstName: 'individual',
    lastName: 'learner',
    userName: 'individual.learner',
    isAdmin: false,
    isFirstTimeLogin: true,
  });

  const hybridLearnerUser = await upsertUser({
    email: 'hybrid_learner@gmail.com',
    firstName: 'Hybrid',
    lastName: 'Learner',
    userName: 'hybrid.learner',
    isAdmin: false,
    isFirstTimeLogin: true,
  });

  const classroomLearnerUser = await upsertUser({
    email: 'classroom_learner@gmail.com',
    firstName: 'Classroom',
    lastName: 'Learner',
    userName: 'classroom.learner',
    isAdmin: false,
    isFirstTimeLogin: true,
  });

  // optional: one user with multiple roles example
  const multiRoleLearnerUser = await upsertUser({
    email: 'student.dev@gmail.com',
    firstName: 'Student',
    lastName: 'Dev',
    userName: 'student.dev',
    isAdmin: false,
    isFirstTimeLogin: true,
  });

  // =========================
  // 5) Assign roles
  // =========================
  await assignRoleToUser(superAdminUser.userId, superAdminRole.roleId);
  // await assignRoleToUser(adminUser.userId, adminRole.roleId);
  await assignRoleToUser(hrFocalUser.userId, hrFocalRole.roleId);
  await assignRoleToUser(
    individualLearnerUser.userId,
    individualLearnerRole.roleId,
  );
  await assignRoleToUser(hybridLearnerUser.userId, hybridLearnerRole.roleId);
  await assignRoleToUser(
    classroomLearnerUser.userId,
    classroomLearnerRole.roleId,
  );

  // example multi-role assignment
  await assignRoleToUser(multiRoleLearnerUser.userId, hybridLearnerRole.roleId);
  await assignRoleToUser(
    multiRoleLearnerUser.userId,
    classroomLearnerRole.roleId,
  );

  // =========================
  // 6) Learner profiles
  // =========================
  const learnerRoleIds = [
    individualLearnerRole.roleId,
    hybridLearnerRole.roleId,
    classroomLearnerRole.roleId,
  ];

  const learnerUsers = await prisma.capeUser.findMany({
    where: {
      userRoles: {
        some: {
          roleId: {
            in: learnerRoleIds,
          },
        },
      },
    },
    select: {
      userId: true,
    },
  });

  for (const u of learnerUsers) {
    await prisma.capeLearnerProfiles.upsert({
      where: { userId: u.userId },
      update: {
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
    `Learner profiles ensured for ${learnerUsers.length} learner users`,
  );

  console.log('✅ Seed complete:', {
    roles: [
      superAdminRole.roleName,
      hrFocalRole.roleName,
      individualLearnerRole.roleName,
      hybridLearnerRole.roleName,
      classroomLearnerRole.roleName,
    ],
    users: [
      'admin@utp.edu.my',
      'hr-focal@petronas.com',
      'individual_learner@gmail.com',
      'hybrid_learner@gmail.com',
      'classroom_learner@gmail.com',
      'student.dev@gmail.com',
    ],
    defaultPassword: 'abc123456',
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
