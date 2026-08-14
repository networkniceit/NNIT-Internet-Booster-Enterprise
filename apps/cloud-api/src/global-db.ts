import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
      max: Number(process.env.NNIT_DB_POOL_MAX ?? 10),
    });
  }

  return pool;
}

export async function initGlobalSchema() {
  const db = getPool();
  if (!db) return false;

  await db.query(`
    CREATE TABLE IF NOT EXISTS nnit_organizations(
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS nnit_devices(
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES nnit_organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'unknown',
      agent_version TEXT,
      country TEXT,
      city TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS nnit_telemetry(
      id BIGSERIAL PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES nnit_organizations(id) ON DELETE CASCADE,
      device_id UUID NOT NULL REFERENCES nnit_devices(id) ON DELETE CASCADE,
      score DOUBLE PRECISION,
      latency_ms DOUBLE PRECISION,
      dns_ms DOUBLE PRECISION,
      jitter_ms DOUBLE PRECISION,
      packet_loss DOUBLE PRECISION,
      cpu_percent DOUBLE PRECISION,
      memory_percent DOUBLE PRECISION,
      free_memory_gb DOUBLE PRECISION,
      disk_free_gb DOUBLE PRECISION,
      download_mbps DOUBLE PRECISION,
      upload_mbps DOUBLE PRECISION,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_nnit_telemetry_device_time
      ON nnit_telemetry(device_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS nnit_commands(
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES nnit_organizations(id) ON DELETE CASCADE,
      device_id UUID NOT NULL REFERENCES nnit_devices(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'queued',
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      delivered_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      result JSONB,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_nnit_commands_device_status
      ON nnit_commands(device_id,status,queued_at);

    CREATE TABLE IF NOT EXISTS nnit_incidents(
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES nnit_organizations(id) ON DELETE CASCADE,
      device_id UUID NOT NULL REFERENCES nnit_devices(id) ON DELETE CASCADE,
      incident_key TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      status TEXT NOT NULL DEFAULT 'open',
      message TEXT NOT NULL DEFAULT '',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(device_id, incident_key)
    );
  `);

  return true;
}

