const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../server/glownest.db');
const db = new sqlite3.Database(dbPath);

const tables = [
  'products',
  'purchases',
  'sales',
  'sale_items',
  'installments',
  'store_settings',
  'expenses',
  'orders',
  'order_payments',
  'users'
];

async function dump() {
  const result = {};

  for (const table of tables) {
    result[table] = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    console.log(`Exported ${table}: ${result[table].length} rows`);
  }

  const dumpPath = path.join(__dirname, '../server/initial_data_dump.json');
  fs.writeFileSync(dumpPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Saved full database dump to ${dumpPath}`);
  db.close();
}

dump().catch(console.error);
