-- Creates the two schemas required by TaskFlow.
--
-- NOTE: schema creation is ALSO done in the Prisma initial migration
-- (migrations/..._init/migration.sql) so it works in Prisma's shadow database.
-- This file only runs once on first postgres container start via
-- docker-entrypoint-initdb.d — it does NOT run in the shadow database.
-- Both files must stay in sync.

CREATE SCHEMA IF NOT EXISTS taskflow;
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant full access to the app user on both schemas
GRANT ALL ON SCHEMA taskflow TO taskflow;
GRANT ALL ON SCHEMA auth TO taskflow;

-- Ensure future tables created in these schemas are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA taskflow GRANT ALL ON TABLES TO taskflow;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth TO taskflow;
