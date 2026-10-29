const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const isTiDB = !!process.env.TIDB_HOST;

let pool = null;
let db = null;

if (isTiDB) {
  pool = mysql.createPool({
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT || '4000', 10),
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE || 'test',
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log(`TiDB Cloud imeunganishwa vizuri (Host: ${process.env.TIDB_HOST}). Hifadhi ya kudumu inafanya kazi.`);
} else {
  const dbPath = path.join(__dirname, 'glownest.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Hitilafu ya kufungua Database:', err.message);
    } else {
      console.log('Database ya ndani (SQLite) ya GLOWNEST Smart Wear imeunganishwa vizuri.');
    }
  });
}

function adaptQuery(query) {
  if (!isTiDB) return query;
  let q = query;
  q = q.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  q = q.replace(/code TEXT UNIQUE NOT NULL/gi, 'code VARCHAR(100) UNIQUE NOT NULL');
  q = q.replace(/receipt_no TEXT UNIQUE NOT NULL/gi, 'receipt_no VARCHAR(100) UNIQUE NOT NULL');
  q = q.replace(/order_no TEXT UNIQUE NOT NULL/gi, 'order_no VARCHAR(100) UNIQUE NOT NULL');
  q = q.replace(/username TEXT UNIQUE NOT NULL/gi, 'username VARCHAR(100) UNIQUE NOT NULL');
  q = q.replace(/key TEXT PRIMARY KEY/gi, '`key` VARCHAR(100) PRIMARY KEY');
  q = q.replace(/store_settings\s*\(\s*key\s*,\s*value\s*\)/gi, 'store_settings (`key`, `value`)');
  q = q.replace(/ON CONFLICT\s*\(\s*key\s*\)\s*DO UPDATE SET value\s*=\s*excluded\.value/gi, 'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
  q = q.replace(/date\('now',\s*'localtime'\)/gi, 'CURDATE()');
  q = q.replace(/date\('now',\s*'-12 months'\)/gi, 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)');
  q = q.replace(/date\('now',\s*'-30 days'\)/gi, 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
  q = q.replace(/date\('now',\s*'-7 days'\)/gi, 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
  q = q.replace(/strftime\('%Y-%m-%d',\s*([^)]+)\)/gi, 'DATE_FORMAT($1, "%Y-%m-%d")');
  q = q.replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, 'DATE_FORMAT($1, "%Y-%m")');
  q = q.replace(/strftime\('%Y',\s*([^)]+)\)/gi, 'DATE_FORMAT($1, "%Y")');
  q = q.replace(/strftime\('%d\/%m',\s*([^)]+)\)/gi, 'DATE_FORMAT($1, "%d/%m")');
  return q;
}

// Helper kwa kutumia Promises na SQLite / TiDB
const dbRun = async (query, params = []) => {
  const adapted = adaptQuery(query);
  if (isTiDB) {
    const [result] = await pool.execute(adapted, params);
    return { id: result.insertId, changes: result.affectedRows };
  }
  return new Promise((resolve, reject) => {
    db.run(adapted, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbAll = async (query, params = []) => {
  const adapted = adaptQuery(query);
  if (isTiDB) {
    const [rows] = await pool.execute(adapted, params);
    return rows;
  }
  return new Promise((resolve, reject) => {
    db.all(adapted, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = async (query, params = []) => {
  const adapted = adaptQuery(query);
  if (isTiDB) {
    const [rows] = await pool.execute(adapted, params);
    return rows[0] || null;
  }
  return new Promise((resolve, reject) => {
    db.get(adapted, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};


// Initialize schema and default data
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      gender_age TEXT NOT NULL,
      size TEXT,
      color TEXT,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_alert INTEGER DEFAULT 3,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      supplier_name TEXT,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      customer_name TEXT DEFAULT 'Mteja wa Kawaida',
      customer_phone TEXT,
      total_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      payment_type TEXT NOT NULL, /* cash, lipa_namba, layaway, credit */
      payment_provider TEXT, /* Cash, Tigo Pesa, Airtel Money, M-Pesa */
      reference_code TEXT,
      amount_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed', /* completed, pending_layaway, credit_active */
      due_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL,
      profit REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_type TEXT NOT NULL,
      reference_code TEXT,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL, /* Nauli/Mzigo Kariakoo, Umeme/LUKU, Vifungashio/Mifuko, Chakula/Maji, Kodi/Fremu, Matangazo, Nyinginezo */
      amount REAL NOT NULL,
      payment_type TEXT DEFAULT 'Cash', /* Cash, Tigo Pesa, Airtel Money */
      expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `);

  // Create orders table for Customer Custom Clothing Orders (Oda za Nguo za Wateja)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      clothing_item TEXT NOT NULL,
      category TEXT DEFAULT 'Nyinginezo',
      size TEXT,
      color TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      target_date DATE NOT NULL,
      estimated_price REAL NOT NULL DEFAULT 0,
      advance_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      status TEXT NOT NULL DEFAULT 'pending', /* pending, ordered, arrived, delivered, cancelled */
      image_url TEXT,
      notes TEXT,
      created_by TEXT DEFAULT 'Muuzaji',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create order_payments table for tracking installment payments on orders
  await dbRun(`
    CREATE TABLE IF NOT EXISTS order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_type TEXT NOT NULL,
      reference_code TEXT,
      notes TEXT,
      cashier_name TEXT DEFAULT 'Muuzaji',
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  // Create users table for Staff & Admin sessions
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_pin TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier', /* 'admin' au 'cashier' */
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure cashier_name and user_id columns exist on sales & installments
  try {
    await dbRun(`ALTER TABLE sales ADD COLUMN cashier_name TEXT DEFAULT 'Muuzaji'`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE sales ADD COLUMN user_id INTEGER`);
  } catch (e) {}
  try {
    await dbRun(`ALTER TABLE installments ADD COLUMN cashier_name TEXT DEFAULT 'Muuzaji'`);
  } catch (e) {}

  // Seed default Admin and Cashier accounts if none exist
  const existingUsers = await dbAll(`SELECT COUNT(*) as count FROM users`);
  if (existingUsers[0].count === 0) {
    await dbRun(`
      INSERT INTO users (username, password_pin, full_name, role, phone)
      VALUES 
        ('admin', '1234', 'ABISHAI EVARISTO NGENZI (Mmiliki)', 'admin', '0656392400'),
        ('muuzaji', '0000', 'CASHIER', 'cashier', '0685073565')
    `);
    console.log('Akaunti za awali za Admin (PIN: 1234) na Muuzaji (PIN: 0000) zimeundwa vizuri.');
  }

  // Update any previous cashier name to CASHIER
  try {
    await dbRun(`UPDATE users SET full_name = 'CASHIER' WHERE username = 'muuzaji'`);
    await dbRun(`UPDATE sales SET cashier_name = 'CASHIER' WHERE cashier_name LIKE '%DORCAS%' OR cashier_name LIKE '%Muuzaji%'`);
    await dbRun(`UPDATE installments SET cashier_name = 'CASHIER' WHERE cashier_name LIKE '%DORCAS%' OR cashier_name LIKE '%Muuzaji%'`);
  } catch (e) {
    // ignore
  }

  // Ensure variants_json column exists for Size & Color breakdown
  try {
    await dbRun(`ALTER TABLE products ADD COLUMN variants_json TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Cleanup any typo phone numbers (e.g. letter O instead of 0)
  try {
    await dbRun(`UPDATE sales SET customer_phone = '0' || SUBSTR(customer_phone, 2) WHERE customer_phone LIKE 'O%' OR customer_phone LIKE 'o%'`);
  } catch (e) {
    // ignore
  }

  // Default store settings
  const defaultSettings = [
    { key: 'store_name', value: 'GLOWNEST Smart Wear' },
    { key: 'owner_name', value: 'ABISHAI EVARISTO NGENZI' },
    { key: 'store_tagline', value: 'Mitindo na Nguo Bora za Kisasa Kutoka Kariakoo' },
    { key: 'store_phone', value: '0656392400 / 0685073565' },
    { key: 'store_phone_primary', value: '0656392400' },
    { key: 'store_phone_secondary', value: '0685073565' },
    { key: 'tigo_lipa_number', value: '44834912' },
    { key: 'tigo_lipa_name', value: 'ABISHAI' },
    { key: 'airtel_lipa_number', value: '136541343' },
    { key: 'airtel_lipa_name', value: 'DORCAS' },
    { key: 'store_location', value: 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ' },
    { key: 'store_logo', value: '/assets/logo.png' },
    { key: 'currency', value: 'TZS' }
  ];

  for (const s of defaultSettings) {
    await dbRun(`
      INSERT INTO store_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [s.key, s.value]);
  }

  // Check if products exist; if not, insert initial Kariakoo clothing sample stock
  const existingProducts = await dbAll(`SELECT COUNT(*) as count FROM products`);
  if (existingProducts[0].count === 0) {
    const sampleProducts = [
      {
        code: 'GN-JNS-01',
        name: 'Jeans Kali ya Kiume (Slim-Fit Stretch)',
        category: 'Jeans',
        gender_age: 'Wanaume',
        size: '30, 32, 34, 36',
        color: 'Blue Fade / Black',
        buy_price: 22000,
        sell_price: 35000,
        stock_quantity: 24,
        image_url: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-MJJ-02',
        name: 'Majeje Jeans (High-Waist Bootcut ya Kike)',
        category: 'Jeans',
        gender_age: 'Wanawake',
        size: '28, 30, 32, 34',
        color: 'Light Blue / Navy',
        buy_price: 25000,
        sell_price: 40000,
        stock_quantity: 18,
        image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-SHT-03',
        name: 'Shati la Pamba (Formal / Casual Slim Fit)',
        category: 'Mashati',
        gender_age: 'Wanaume',
        size: 'M, L, XL, XXL',
        color: 'White, Navy, Maroon',
        buy_price: 18000,
        sell_price: 30000,
        stock_quantity: 30,
        image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-GAU-04',
        name: 'Gauni la Kifahari la Harusi na Sherehe',
        category: 'Magauni',
        gender_age: 'Wanawake',
        size: 'Free Size, L, XL',
        color: 'Emerald Green / Gold',
        buy_price: 35000,
        sell_price: 65000,
        stock_quantity: 12,
        image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-TRK-05',
        name: 'Tracksuit Full Set (Jacket + Suruali Safi)',
        category: 'Tracksuits',
        gender_age: 'Unisex',
        size: 'M, L, XL, XXL',
        color: 'Black/White, Grey, Navy',
        buy_price: 28000,
        sell_price: 48000,
        stock_quantity: 20,
        image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-TSH-06',
        name: 'T-Shirt Kali ya Pamba (Heavyweight Cotton)',
        category: 'T-Shirts',
        gender_age: 'Unisex',
        size: 'S, M, L, XL',
        color: 'Oversize Black, White, Brown',
        buy_price: 12000,
        sell_price: 20000,
        stock_quantity: 45,
        image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-SRL-07',
        name: 'Suruali ya Kitambaa ya Ofisini & Mitoko',
        category: 'Suruali',
        gender_age: 'Wanaume',
        size: '30, 32, 34, 36, 38',
        color: 'Grey, Black, Khaki',
        buy_price: 20000,
        sell_price: 35000,
        stock_quantity: 15,
        image_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80'
      },
      {
        code: 'GN-KID-08',
        name: 'Seti ya Nguo za Watoto (Kaptula + T-Shirt)',
        category: 'Watoto',
        gender_age: 'Watoto',
        size: 'Miaka 2-5, 6-10',
        color: 'Multicolor',
        buy_price: 15000,
        sell_price: 25000,
        stock_quantity: 22,
        image_url: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80'
      }
    ];

    for (const p of sampleProducts) {
      await dbRun(`
        INSERT INTO products (code, name, category, gender_age, size, color, buy_price, sell_price, stock_quantity, min_stock_alert, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 3, ?)
      `, [p.code, p.name, p.category, p.gender_age, p.size, p.color, p.buy_price, p.sell_price, p.stock_quantity, p.image_url]);
    }
    console.log('Bidhaa za sampuli za Kariakoo zimeingizwa kwenye database!');
  }

  // Seed sample orders if none exist
  const existingOrders = await dbAll(`SELECT COUNT(*) as count FROM orders`);
  if (existingOrders[0].count === 0) {
    const today = new Date();
    const date1 = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0];
    const date2 = new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0];

    const ord1 = await dbRun(`
      INSERT INTO orders (
        order_no, customer_name, customer_phone, clothing_item, category, size, color,
        quantity, target_date, estimated_price, advance_paid, balance_due, payment_method,
        status, image_url, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ORD-' + Date.now().toString().slice(-6),
      'Asha Juma',
      '0715123456',
      'Suti ya Kike ya Ofisini (Coat + Suruali)',
      'Magauni',
      'Size 34',
      'Navy Blue',
      1,
      date1,
      85000,
      40000,
      45000,
      'Tigo Pesa',
      'ordered',
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80',
      'Iagizwe Kariakoo haraka kwa ajili ya mahafali mwishoni mwa wiki.',
      'CASHIER'
    ]);

    await dbRun(`
      INSERT INTO order_payments (order_id, amount, payment_type, notes, cashier_name)
      VALUES (?, ?, ?, ?, ?)
    `, [ord1.id, 40000, 'Tigo Pesa', 'Malipo ya awali ya oda', 'CASHIER']);

    const ord2 = await dbRun(`
      INSERT INTO orders (
        order_no, customer_name, customer_phone, clothing_item, category, size, color,
        quantity, target_date, estimated_price, advance_paid, balance_due, payment_method,
        status, image_url, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ORD-' + (Date.now() + 1).toString().slice(-6),
      'Juma Bakari',
      '0754987654',
      'Jeans Kali ya Kiume (Slim Stretch)',
      'Jeans',
      'Size 32',
      'Black Fade',
      2,
      date2,
      70000,
      35000,
      35000,
      'Cash',
      'pending',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80',
      'Anahitaji pcs 2 za rangi nyeusi safi.',
      'ABISHAI EVARISTO NGENZI (Mmiliki)'
    ]);

    await dbRun(`
      INSERT INTO order_payments (order_id, amount, payment_type, notes, cashier_name)
      VALUES (?, ?, ?, ?, ?)
    `, [ord2.id, 35000, 'Cash', 'Malipo ya awali ya oda', 'ABISHAI EVARISTO NGENZI (Mmiliki)']);

    console.log('Oda za mfano zimeingizwa kwenye database!');
  }
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase
};
