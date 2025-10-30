import dotenv from 'dotenv';

dotenv.config();
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize the sessions table
await pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    access_key TEXT PRIMARY KEY,
    session_data JSONB NOT NULL
  );
`);

export async function saveSession(accessKey, sessionData) {
  await pool.query(
    'INSERT INTO sessions (access_key, session_data) VALUES ($1, $2) ON CONFLICT (access_key) DO UPDATE SET session_data = $2',
    [accessKey, sessionData]
  );
}

export async function getSession(accessKey) {
  const result = await pool.query(
    'SELECT session_data FROM sessions WHERE access_key = $1',
    [accessKey]
  );
  
  return result.rows[0]?.session_data || null;
}
