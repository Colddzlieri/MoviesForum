const fs = require('fs');
const os = require('os');
const path = require('path');

const bundledDataDir = path.join(__dirname, 'data');
const bundledDbPath = path.join(bundledDataDir, 'db.json');
const dataDir = process.env.VERCEL ? path.join(os.tmpdir(), 'coldmovie-data') : bundledDataDir;
const dbPath = path.join(dataDir, 'db.json');
const databaseUrl = process.env.DATABASE_URL || '';

const initialDb = {
  users: [],
  favorites: {},
  watchlist: {},
  reviews: {},
  posts: [],
  reels: [],
  activities: [],
};

let pool = null;
let postgresReady = false;

function normalizeDb(value) {
  return { ...initialDb, ...(value && typeof value === 'object' ? value : {}) };
}

function ensureFileDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    if (process.env.VERCEL && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, dbPath);
      return;
    }

    fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2));
  }
}

function readFileDb() {
  ensureFileDb();
  try {
    return normalizeDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
  } catch {
    return normalizeDb();
  }
}

function writeFileDb(db) {
  ensureFileDb();
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(normalizeDb(db), null, 2));
  fs.renameSync(tempPath, dbPath);
}

function shouldUsePostgres() {
  return Boolean(databaseUrl);
}

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensurePostgresDb(client = getPool()) {
  if (postgresReady) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS coldmovie_state (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const existing = await client.query('SELECT 1 FROM coldmovie_state WHERE id = $1', ['main']);
  if (!existing.rowCount) {
    await client.query('INSERT INTO coldmovie_state (id, data) VALUES ($1, $2::jsonb)', ['main', JSON.stringify(readFileDb())]);
  }
  postgresReady = true;
}

async function readDb() {
  if (!shouldUsePostgres()) {
    return readFileDb();
  }

  const client = getPool();
  await ensurePostgresDb(client);
  const result = await client.query('SELECT data FROM coldmovie_state WHERE id = $1', ['main']);
  return normalizeDb(result.rows[0]?.data);
}

async function updateDb(mutator) {
  if (!shouldUsePostgres()) {
    const db = readFileDb();
    const result = mutator(db);
    writeFileDb(db);
    return result;
  }

  const client = await getPool().connect();
  try {
    await ensurePostgresDb(client);
    await client.query('BEGIN');
    const selected = await client.query('SELECT data FROM coldmovie_state WHERE id = $1 FOR UPDATE', ['main']);
    const db = normalizeDb(selected.rows[0]?.data);
    const result = mutator(db);
    await client.query('UPDATE coldmovie_state SET data = $2::jsonb, updated_at = now() WHERE id = $1', ['main', JSON.stringify(normalizeDb(db))]);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { readDb, updateDb };
