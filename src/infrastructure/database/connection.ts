import pg from 'pg'
import { config } from '../config/config.js'

const { Pool } = pg;

export const pool = new Pool( config.database );

pool.on('error', (err) => {
  console.error('Unexpected error on pool idle client', err);
});

export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
}
await testConnection();