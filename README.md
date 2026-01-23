# CAPE LMS Backend

CAPE LMS Backend is a **NestJS 11** backend service powering the CAPE UTP (Centre for Advanced and Professional Education) platform.
It integrates with **LearnWorlds** and provides APIs for authentication, onboarding, program access, enrollment automation, and progress-related data processing.

A key backend design goal is **reliable integration with external systems (LearnWorlds)** while keeping the CAPE application responsive.
To achieve this, CAPE uses **Redis + BullMQ** for queue-based asynchronous processing, especially for **LearnWorlds webhook events**.

---

## 🧱 Tech Stack Overview

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: Microsoft SQL Server
- **ORM**: Prisma (MSSQL adapter)
- **Queue / Background Jobs**: BullMQ + Redis
- **Containerization**: Docker (Redis runtime)
- **Security**
  - `jose` – JWT signing & verification
  - `bcrypt` – password hashing
  - `helmet` – HTTP security headers
  - `cookie-parser` – cookie handling (if enabled)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest, Supertest
- **Code Quality**: ESLint, Prettier

---

## 🎯 Design Principles

- Fast and reliable webhook handling
- Asynchronous processing for external integrations
- Clear separation between request lifecycle and background jobs
- Production-safe handling of retries, failures, and idempotency

---

## ⚙️ Prerequisites (Before You Start)

Ensure the following are installed on your machine:

- **Node.js 18+**
- **Docker Desktop**
- **Git**
- **Access to a SQL Server database** (local or remote)

---

## 📦 Install Dependencies

```bash
npm install
```

---

## 🔐 Environment Configuration

The backend relies on environment-based configuration.

### Environment files

- `.env.development` (local development)
- `.env.production` (production deployment)

These files are loaded using `dotenv-cli` in npm scripts.

### Important variables (example)

```env
DATABASE_URL=sqlserver://...
JWT_SECRET=your-secret
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
```

### ⚠️ Important Notes

- Database credentials **must be updated** in `.env.development` before running locally
- Never commit real production secrets
- Use `.env.example` if variables need to be shared safely

---

## 🧰 Redis & BullMQ (CRITICAL SECTION)

### Why Redis + BullMQ is used

LearnWorlds triggers events (user enrollment, bulk imports, updates) via **webhooks**.
Webhooks must respond quickly to avoid retries or failures, but processing can be heavy.

CAPE uses the following flow:

**Webhook API → Immediate ACK → Queue Job (BullMQ) → Background Worker → Database Updates**

### Benefits

- Prevents webhook timeouts
- Handles traffic bursts safely
- Enables retries and failure recovery
- Improves overall system reliability

---

## 🐳 Redis Setup Using Docker (Required)

### Manual Docker Control

Start Redis:

```bash
docker run -d --name redis-bullmq -p 6379:6379 redis:7
```

Start existing container:

```bash
docker start redis-bullmq
```

Stop Redis:

```bash
docker stop redis-bullmq
```

Remove container:

```bash
docker rm -f redis-bullmq
```

---

## ▶️ Running the Backend

### Development Mode (Recommended)

```bash
npm run start:dev
```

What happens:

- Ensures Redis is running
- Starts NestJS in watch mode

---

---

## 🗃️ Prisma ORM Notes

- Prisma is used as the ORM layer
- Microsoft SQL Server is the primary database
- Database credentials must be configured in `.env.development`

### Common Prisma Commands

Generate client:

```bash
npm run generate:dev
```

Run migrations (development):

```bash
npm run migrate:dev
```

Reset database (development only):

```bash
npm run reset:dev
```

Seed database:

```bash
npm run seed:dev
```

Deploy migrations (production):

```bash
npm run migrate:deploy
```

---

---

## 🧹 Linting & Formatting

Lint and auto-fix:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

---

## 🌐 LearnWorlds Integration (High Level)

- LearnWorlds sends webhook events to this backend
- Events are validated and acknowledged immediately
- Payloads are queued using BullMQ
- Background workers process events:
  - User & enrollment upserts
  - Idempotency checks
  - Enrollment automation
  - Internal CAPE state updates

This design ensures LearnWorlds integration never blocks user-facing APIs.

---

## 🧠 Developer Handover Checklist

For a new developer:

1. Install dependencies
   ```bash
   npm install
   ```
2. Configure `.env.development` (DB + Redis)
3. Start Redis
   ```bash
   npm run redis:up or npm run start:dev - Development Mode
   ```
4. Run Prisma migrations
   ```bash
   npm run migrate:dev
   ```
5. Start backend
   ```bash
   npm run start:dev
   ```
6. Verify webhook queue processing via logs

---

## 🛠️ Common Issues & Fixes

### Redis / BullMQ not working

```bash
npm run redis:up
docker ps
```

### Database connection issues

- Check DATABASE_URL in `.env.development`
- Ensure SQL Server is reachable

```bash
npm run generate:dev
npm run migrate:dev
```

### Port conflicts

- Redis: 6379
- Backend: check NestJS config (commonly 3000/3001)

---

## 📄 License

Private project – Document Created By Arvend Rajan.
