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
    const [result] = await pool.query(adapted, params);
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
    const [rows] = await pool.query(adapted, params);
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
    const [rows] = await pool.query(adapted, params);
    return rows[0] || null;
  }
  return new Promise((resolve, reject) => {
    db.get(adapted, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};


// Initialize schema for TiDB Cloud Serverless
async function initTiDBDatabase() {
  console.log('TiDB: Kuangalia na kuunda majedwali ya database...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      gender_age VARCHAR(50) NOT NULL,
      size VARCHAR(100),
      color VARCHAR(100),
      buy_price DECIMAL(12, 2) NOT NULL,
      sell_price DECIMAL(12, 2) NOT NULL,
      stock_quantity INT NOT NULL DEFAULT 0,
      min_stock_alert INT DEFAULT 3,
      image_url TEXT,
      variants_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      supplier_name VARCHAR(255),
      quantity INT NOT NULL,
      unit_cost DECIMAL(12, 2) NOT NULL,
      total_cost DECIMAL(12, 2) NOT NULL,
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_no VARCHAR(100) UNIQUE NOT NULL,
      customer_name VARCHAR(255) DEFAULT 'Mteja wa Kawaida',
      customer_phone VARCHAR(50),
      total_amount DECIMAL(12, 2) NOT NULL,
      discount DECIMAL(12, 2) DEFAULT 0,
      net_amount DECIMAL(12, 2) NOT NULL,
      payment_type VARCHAR(50) NOT NULL,
      payment_provider VARCHAR(50),
      reference_code VARCHAR(100),
      amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
      balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'completed',
      due_date DATE,
      notes TEXT,
      cashier_name VARCHAR(100) DEFAULT 'CASHIER',
      user_id INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(12, 2) NOT NULL,
      unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(12, 2) NOT NULL,
      profit DECIMAL(12, 2) NOT NULL DEFAULT 0,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS installments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_type VARCHAR(50) NOT NULL,
      reference_code VARCHAR(100),
      cashier_name VARCHAR(100) DEFAULT 'CASHIER',
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_type VARCHAR(50) DEFAULT 'Cash',
      expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(100) UNIQUE NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) NOT NULL,
      clothing_item VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'Nyinginezo',
      size VARCHAR(100),
      color VARCHAR(100),
      quantity INT NOT NULL DEFAULT 1,
      target_date DATE NOT NULL,
      estimated_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
      advance_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
      balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'Cash',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      image_url TEXT,
      notes TEXT,
      created_by VARCHAR(100) DEFAULT 'CASHIER',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_type VARCHAR(50) NOT NULL,
      reference_code VARCHAR(100),
      notes TEXT,
      cashier_name VARCHAR(100) DEFAULT 'CASHIER',
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_pin VARCHAR(50) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'cashier',
      phone VARCHAR(50),
      is_active INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed Admin & Cashier if not exist
  const [existingUsers] = await pool.query(`SELECT COUNT(*) as count FROM users`);
  if (!existingUsers[0] || existingUsers[0].count === 0) {
    await pool.query(`
      INSERT INTO users (username, password_pin, full_name, role, phone)
      VALUES 
        ('admin', '1234', 'ABISHAI EVARISTO NGENZI (Mmiliki)', 'admin', '0656392400'),
        ('muuzaji', '0000', 'CASHIER', 'cashier', '0685073565')
      ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)
    `);
    console.log('TiDB: Akaunti za awali za Admin (PIN: 1234) na Muuzaji (PIN: 0000) zimeundwa vizuri!');
  }

  // Seed default settings
  const defaultSettings = [
    ['store_name', 'GLOWNEST Smart Wear'],
    ['owner_name', 'ABISHAI EVARISTO NGENZI'],
    ['store_tagline', 'Mitindo na Nguo Bora za Kisasa Kutoka Kariakoo'],
    ['store_phone', '0656392400 / 0685073565'],
    ['store_phone_primary', '0656392400'],
    ['store_phone_secondary', '0685073565'],
    ['tigo_lipa_number', '44834912'],
    ['tigo_lipa_name', 'ABISHAI'],
    ['airtel_lipa_number', '136541343'],
    ['airtel_lipa_name', 'DORCAS'],
    ['store_location', 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ'],
    ['store_logo', '/assets/logo.png'],
    ['currency', 'TZS']
  ];

  for (const [k, v] of defaultSettings) {
    await pool.query(`
      INSERT INTO store_settings (\`key\`, \`value\`) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)
    `, [k, v]);
  }

  // Seed sample Kariakoo products if empty
  const [existingProducts] = await pool.query(`SELECT COUNT(*) as count FROM products`);
  if (!existingProducts[0] || existingProducts[0].count === 0) {
    const sampleProducts = [
      ['GN-JNS-01', 'Jeans Kali ya Kiume (Slim-Fit Stretch)', 'Jeans', 'Wanaume', '30, 32, 34, 36', 'Blue Fade / Black', 22000, 35000, 24, 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80'],
      ['GN-MJJ-02', 'Majeje Jeans (High-Waist Bootcut ya Kike)', 'Jeans', 'Wanawake', '28, 30, 32, 34', 'Light Blue / Navy', 25000, 40000, 18, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80'],
      ['GN-SHT-03', 'Shati la Pamba (Formal / Casual Slim Fit)', 'Mashati', 'Wanaume', 'M, L, XL, XXL', 'White, Navy, Maroon', 18000, 30000, 30, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80'],
      ['GN-GAU-04', 'Gauni la Kifahari la Harusi na Sherehe', 'Magauni', 'Wanawake', 'Free Size, L, XL', 'Emerald Green / Gold', 35000, 65000, 12, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80'],
      ['GN-TRK-05', 'Tracksuit Full Set (Jacket + Suruali Safi)', 'Tracksuits', 'Unisex', 'M, L, XL, XXL', 'Black/White, Grey, Navy', 28000, 48000, 20, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80'],
      ['GN-TSH-06', 'T-Shirt Kali ya Pamba (Heavyweight Cotton)', 'T-Shirts', 'Unisex', 'S, M, L, XL', 'Oversize Black, White, Brown', 12000, 20000, 45, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'],
      ['GN-SRL-07', 'Suruali ya Kitambaa ya Ofisini & Mitoko', 'Suruali', 'Wanaume', '30, 32, 34, 36, 38', 'Grey, Black, Khaki', 20000, 35000, 15, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80'],
      ['GN-KID-08', 'Seti ya Nguo za Watoto (Kaptula + T-Shirt)', 'Watoto', 'Watoto', 'Miaka 2-5, 6-10', 'Multicolor', 15000, 25000, 22, 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80']
    ];

    for (const p of sampleProducts) {
      await pool.query(`
        INSERT INTO products (code, name, category, gender_age, size, color, buy_price, sell_price, stock_quantity, min_stock_alert, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 3, ?)
      `, p);
    }
    console.log('TiDB: Bidhaa za sampuli za Kariakoo zimeingizwa vizuri!');
  }

  // Automatic sync from SQLite dump to TiDB
  try {
    await syncDumpToTiDB();
  } catch (err) {
    console.error('Hitilafu ya kusawazisha data dump kwenda TiDB:', err);
  }

  console.log('TiDB Cloud: Majedwali na data zote za awali zimekamilika kwa mafanikio!');
}

async function syncDumpToTiDB() {
  if (!isTiDB || !pool) {
    return { success: false, message: 'Not connected to TiDB Cloud' };
  }

  const dumpPath = path.join(__dirname, 'initial_data_dump.json');
  if (!fs.existsSync(dumpPath)) {
    console.log('Hakuna faili la initial_data_dump.json la kusawazisha.');
    return { success: false, message: 'Dump file not found' };
  }

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  console.log('TiDB: Inasawazisha taarifa zote kutoka SQLite dump...');

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    // 1. Users
    if (Array.isArray(dump.users)) {
      for (const u of dump.users) {
        await pool.query(`
          INSERT INTO users (id, username, password_pin, full_name, role, phone, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            password_pin = VALUES(password_pin), full_name = VALUES(full_name),
            role = VALUES(role), phone = VALUES(phone), is_active = VALUES(is_active)
        `, [u.id, u.username, u.password_pin, u.full_name, u.role, u.phone, u.is_active, u.created_at]);
      }
    }

    // 2. Products
    if (Array.isArray(dump.products)) {
      for (const p of dump.products) {
        await pool.query(`
          INSERT INTO products (id, code, name, category, gender_age, size, color, buy_price, sell_price, stock_quantity, min_stock_alert, image_url, variants_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            code = VALUES(code), name = VALUES(name), category = VALUES(category),
            gender_age = VALUES(gender_age), size = VALUES(size), color = VALUES(color),
            buy_price = VALUES(buy_price), sell_price = VALUES(sell_price),
            stock_quantity = VALUES(stock_quantity), min_stock_alert = VALUES(min_stock_alert),
            image_url = VALUES(image_url), variants_json = VALUES(variants_json)
        `, [p.id, p.code, p.name, p.category, p.gender_age, p.size, p.color, p.buy_price, p.sell_price, p.stock_quantity, p.min_stock_alert, p.image_url, p.variants_json, p.created_at]);
      }
    }

    // 3. Purchases
    if (Array.isArray(dump.purchases)) {
      for (const pu of dump.purchases) {
        await pool.query(`
          INSERT INTO purchases (id, product_id, supplier_name, quantity, unit_cost, total_cost, purchase_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            product_id = VALUES(product_id), supplier_name = VALUES(supplier_name),
            quantity = VALUES(quantity), unit_cost = VALUES(unit_cost),
            total_cost = VALUES(total_cost), purchase_date = VALUES(purchase_date),
            notes = VALUES(notes)
        `, [pu.id, pu.product_id, pu.supplier_name, pu.quantity, pu.unit_cost, pu.total_cost, pu.purchase_date, pu.notes]);
      }
    }

    // 4. Sales
    if (Array.isArray(dump.sales)) {
      for (const s of dump.sales) {
        await pool.query(`
          INSERT INTO sales (id, receipt_no, customer_name, customer_phone, total_amount, discount, net_amount, payment_type, payment_provider, reference_code, amount_paid, balance_due, status, due_date, notes, cashier_name, user_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            receipt_no = VALUES(receipt_no), customer_name = VALUES(customer_name),
            customer_phone = VALUES(customer_phone), total_amount = VALUES(total_amount),
            discount = VALUES(discount), net_amount = VALUES(net_amount),
            payment_type = VALUES(payment_type), payment_provider = VALUES(payment_provider),
            reference_code = VALUES(reference_code), amount_paid = VALUES(amount_paid),
            balance_due = VALUES(balance_due), status = VALUES(status),
            due_date = VALUES(due_date), notes = VALUES(notes),
            cashier_name = VALUES(cashier_name), user_id = VALUES(user_id)
        `, [s.id, s.receipt_no, s.customer_name, s.customer_phone, s.total_amount, s.discount, s.net_amount, s.payment_type, s.payment_provider, s.reference_code, s.amount_paid, s.balance_due, s.status, s.due_date, s.notes, s.cashier_name, s.user_id, s.created_at]);
      }
    }

    // 5. Sale Items
    if (Array.isArray(dump.sale_items)) {
      for (const si of dump.sale_items) {
        await pool.query(`
          INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, subtotal, profit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            sale_id = VALUES(sale_id), product_id = VALUES(product_id),
            product_name = VALUES(product_name), quantity = VALUES(quantity),
            unit_price = VALUES(unit_price), unit_cost = VALUES(unit_cost),
            subtotal = VALUES(subtotal), profit = VALUES(profit)
        `, [si.id, si.sale_id, si.product_id, si.product_name, si.quantity, si.unit_price, si.unit_cost, si.subtotal, si.profit]);
      }
    }

    // 6. Installments
    if (Array.isArray(dump.installments)) {
      for (const inst of dump.installments) {
        await pool.query(`
          INSERT INTO installments (id, sale_id, amount, payment_type, reference_code, cashier_name, paid_at, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            sale_id = VALUES(sale_id), amount = VALUES(amount),
            payment_type = VALUES(payment_type), reference_code = VALUES(reference_code),
            cashier_name = VALUES(cashier_name), paid_at = VALUES(paid_at),
            notes = VALUES(notes)
        `, [inst.id, inst.sale_id, inst.amount, inst.payment_type, inst.reference_code, inst.cashier_name, inst.paid_at, inst.notes]);
      }
    }

    // 7. Store Settings
    if (Array.isArray(dump.store_settings)) {
      for (const st of dump.store_settings) {
        await pool.query(`
          INSERT INTO store_settings (\`key\`, \`value\`)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)
        `, [st.key, st.value]);
      }
    }

    // 8. Expenses
    if (Array.isArray(dump.expenses)) {
      for (const ex of dump.expenses) {
        await pool.query(`
          INSERT INTO expenses (id, title, category, amount, payment_type, expense_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title), category = VALUES(category),
            amount = VALUES(amount), payment_type = VALUES(payment_type),
            expense_date = VALUES(expense_date), notes = VALUES(notes)
        `, [ex.id, ex.title, ex.category, ex.amount, ex.payment_type, ex.expense_date, ex.notes]);
      }
    }

    // 9. Orders
    if (Array.isArray(dump.orders)) {
      for (const o of dump.orders) {
        await pool.query(`
          INSERT INTO orders (id, order_no, customer_name, customer_phone, clothing_item, category, size, color, quantity, target_date, estimated_price, advance_paid, balance_due, payment_method, status, image_url, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            order_no = VALUES(order_no), customer_name = VALUES(customer_name),
            customer_phone = VALUES(customer_phone), clothing_item = VALUES(clothing_item),
            category = VALUES(category), size = VALUES(size), color = VALUES(color),
            quantity = VALUES(quantity), target_date = VALUES(target_date),
            estimated_price = VALUES(estimated_price), advance_paid = VALUES(advance_paid),
            balance_due = VALUES(balance_due), payment_method = VALUES(payment_method),
            status = VALUES(status), image_url = VALUES(image_url), notes = VALUES(notes),
            created_by = VALUES(created_by), updated_at = VALUES(updated_at)
        `, [o.id, o.order_no, o.customer_name, o.customer_phone, o.clothing_item, o.category, o.size, o.color, o.quantity, o.target_date, o.estimated_price, o.advance_paid, o.balance_due, o.payment_method, o.status, o.image_url, o.notes, o.created_by, o.created_at, o.updated_at]);
      }
    }

    // 10. Order Payments
    if (Array.isArray(dump.order_payments)) {
      for (const op of dump.order_payments) {
        await pool.query(`
          INSERT INTO order_payments (id, order_id, amount, payment_type, reference_code, notes, cashier_name, paid_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            order_id = VALUES(order_id), amount = VALUES(amount),
            payment_type = VALUES(payment_type), reference_code = VALUES(reference_code),
            notes = VALUES(notes), cashier_name = VALUES(cashier_name),
            paid_at = VALUES(paid_at)
        `, [op.id, op.order_id, op.amount, op.payment_type, op.reference_code, op.notes, op.cashier_name, op.paid_at]);
      }
    }

    console.log('TiDB: Usawazishaji wa taarifa zote kutoka dump umekamilika kikamilifu!');
    return {
      success: true,
      message: 'All tables synced to TiDB Cloud successfully',
      stats: {
        products: dump.products?.length || 0,
        purchases: dump.purchases?.length || 0,
        sales: dump.sales?.length || 0,
        sale_items: dump.sale_items?.length || 0,
        installments: dump.installments?.length || 0,
        expenses: dump.expenses?.length || 0,
        orders: dump.orders?.length || 0,
        order_payments: dump.order_payments?.length || 0,
        settings: dump.store_settings?.length || 0
      }
    };
  } finally {
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

// Initialize schema and default data
async function initDatabase() {
  if (isTiDB) {
    return await initTiDBDatabase();
  }

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
  initDatabase,
  syncDumpToTiDB
};
