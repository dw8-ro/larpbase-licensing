const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function createTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      key_raw TEXT UNIQUE,
      key TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'Active Plan',
      product TEXT NOT NULL DEFAULT 'phantom',
      paypal_txn TEXT,
      customer_email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      device_id TEXT,
      device_bound_at TIMESTAMPTZ,
      previous_device_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);
  console.log('✓ licenses table ready');
}

module.exports = { query, createTables };
