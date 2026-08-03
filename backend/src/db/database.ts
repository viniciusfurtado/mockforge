import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/mockforge.db');

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'dynamic',
      statusCode INTEGER NOT NULL DEFAULT 200,
      delayMs INTEGER NOT NULL DEFAULT 0,
      errorRate INTEGER NOT NULL DEFAULT 0,
      schema TEXT NOT NULL,
      staticResponse TEXT,
      fieldOverrides TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      endpointId TEXT NOT NULL,
      recordId TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(endpointId) REFERENCES endpoints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      endpointId TEXT,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      statusCode INTEGER NOT NULL,
      responseDelay INTEGER NOT NULL,
      isSimulatedError INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration de seguranca caso a coluna fieldOverrides nao exista em bancos antigos
  try {
    await dbInstance.exec(`ALTER TABLE endpoints ADD COLUMN fieldOverrides TEXT`);
  } catch (e) {
    // Coluna ja existe
  }

  console.log('✅ SQLite Database initialized at:', dbPath);
  return dbInstance;
}
