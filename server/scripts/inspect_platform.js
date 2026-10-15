import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_mDdby3pvlk8N@ep-round-frost-b51q919y-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT data FROM admin_platforms WHERE id = 1');
  console.log('Platform 1:', JSON.stringify(res.rows[0]?.data, null, 2));
  await pool.end();
}
main();
