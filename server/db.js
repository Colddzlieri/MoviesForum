const fs = require('fs');
const os = require('os');
const path = require('path');

const bundledDataDir = path.join(__dirname, 'data');
const bundledDbPath = path.join(bundledDataDir, 'db.json');
const dataDir = process.env.VERCEL ? path.join(os.tmpdir(), 'coldmovie-data') : bundledDataDir;
const dbPath = path.join(dataDir, 'db.json');

const initialDb = {
  users: [],
  favorites: {},
  watchlist: {},
  reviews: {},
  posts: [],
  activities: [],
};

function ensureDb() {
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

function readDb() {
  ensureDb();
  try {
    return { ...initialDb, ...JSON.parse(fs.readFileSync(dbPath, 'utf8')) };
  } catch {
    return { ...initialDb };
  }
}

function writeDb(db) {
  ensureDb();
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2));
  fs.renameSync(tempPath, dbPath);
}

function updateDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

module.exports = { readDb, updateDb };
