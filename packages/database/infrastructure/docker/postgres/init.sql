-- Creates the two schemas required by TaskFlow
-- Runs once on first postgres container start via docker-entrypoint-initdb.d.

-- Application data schema (managed by Prisma migrations)
CREATE SCHEMA IF NOT EXISTS taskflow;

-- Auth schema for NextAuth v4 tables (User, Account, Session, VerificationToken)
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant full access to the app user on both schemas
GRANT ALL ON SCHEMA taskflow TO taskflow;
GRANT ALL ON SCHEMA auth TO taskflow;

-- Ensure future tables created in these schemas are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA taskflow GRANT ALL ON TABLES TO taskflow;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO taskflow;
