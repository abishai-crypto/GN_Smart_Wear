require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { db, dbRun, dbAll, dbGet, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Upload directory setup
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for product and order images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = (req.originalUrl && req.originalUrl.includes('order')) ? 'order-' : 'product-';
    cb(null, prefix + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept standard image types
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Tafadhali chagua faili la picha (JPG, PNG, WEBP, n.k.)!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // Up to 20MB
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize DB schema
initDatabase().catch(err => console.error('Database init error:', err));

// ==========================================
// 0. AUTHENTICATION & USERS (SESSION ZA WAUZAJI NA ADMIN)
// ==========================================

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password_pin } = req.body;
    if (!username || !password_pin) {
      return res.status(400).json({ success: false, message: 'Tafadhali jaza Jina/Username na PIN!' });
    }

    const cleanUser = String(username).trim();
    const cleanPin = String(password_pin).trim();

    // 1. Pata mtumiaji kwa jina au role
    const user = await dbGet(`
      SELECT id, username, full_name, role, phone, is_active, password_pin
      FROM users
      WHERE (LOWER(username) = LOWER(?) OR LOWER(role) = LOWER(?))
        AND is_active = 1
    `, [cleanUser, cleanUser]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Jina la Mtumiaji (' + cleanUser + ') halipo au limefungwa!' });
    }

    // 2. Thibitisha PIN (inakubali PIN ya sasa ya database na PIN za kuanzia 1234/0205 kwa Admin, 0000/2326 kwa Muuzaji)
    const isAdmin = (user.role && user.role.toLowerCase() === 'admin') || user.username.toLowerCase() === 'admin';
    const isCashier = (user.role && user.role.toLowerCase() === 'cashier') || user.username.toLowerCase() === 'muuzaji';

    const isValidPin =
      String(user.password_pin).trim() === cleanPin ||
      (isAdmin && (cleanPin === '1234' || cleanPin === '0205')) ||
      (isCashier && (cleanPin === '0000' || cleanPin === '2326'));

    if (!isValidPin) {
      return res.status(401).json({ success: false, message: 'PIN ya siri si sahihi!' });
    }

    res.json({
      success: true,
      message: `Karibu, ${user.full_name}!`,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all staff / users (Admin view)
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await dbAll(`
      SELECT id, username, full_name, role, phone, is_active, created_at, password_pin
      FROM users
      ORDER BY role ASC, id ASC
    `);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new user / cashier (Admin view)
app.post('/api/auth/users', async (req, res) => {
  try {
    const { username, password_pin, full_name, role, phone } = req.body;
    if (!username || !password_pin || !full_name) {
      return res.status(400).json({ success: false, message: 'Tafadhali jaza Jina Kamili, Username na PIN!' });
    }
    const cleanUser = String(username).trim().toLowerCase();
    const existing = await dbGet(`SELECT id FROM users WHERE LOWER(username) = ?`, [cleanUser]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username hii tayari ipo! Chagua nyingine.' });
    }

    const result = await dbRun(`
      INSERT INTO users (username, password_pin, full_name, role, phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [cleanUser, String(password_pin).trim(), String(full_name).trim(), role || 'cashier', phone || '']);

    res.json({ success: true, message: 'Mtumiaji mpya ameongezwa kikamilifu!', userId: result.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user details or reset PIN
app.put('/api/auth/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, phone, is_active, password_pin, username } = req.body;

    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Mtumiaji hajapatikana!' });

    const newName = full_name ? String(full_name).trim() : user.full_name;
    const newUsername = username ? String(username).trim().toLowerCase() : user.username;
    const newRole = role || user.role;
    const newPhone = phone !== undefined ? phone : user.phone;
    const newActive = is_active !== undefined ? parseInt(is_active) : user.is_active;
    const newPin = password_pin && String(password_pin).trim() ? String(password_pin).trim() : user.password_pin;

    await dbRun(`
      UPDATE users 
      SET full_name = ?, username = ?, role = ?, phone = ?, is_active = ?, password_pin = ?
      WHERE id = ?
    `, [newName, newUsername, newRole, newPhone, newActive, newPin, id]);

    res.json({ success: true, message: 'Taarifa za mfanyakazi zimesasishwa!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete user
app.delete('/api/auth/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Mtumiaji hajapatikana!' });
    if (user.username === 'admin') {
      return res.status(400).json({ success: false, message: 'Huwezi kufuta akaunti kuu ya Admin!' });
    }
    await dbRun(`DELETE FROM users WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Mfanyakazi ameondolewa kikamilifu!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 1. PRODUCTS & INVENTORY (BIDHAA NA STOO)
// ==========================================

// Get all products (with role-based confidentiality)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, gender, role } = req.query;
    const userRole = role || req.headers['x-user-role'];
    let query = `SELECT * FROM products WHERE 1=1`;
    const params = [];

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }
    if (gender && gender !== 'all') {
      query += ` AND gender_age = ?`;
      params.push(gender);
    }
    if (search) {
      query += ` AND (name LIKE ? OR code LIKE ? OR size LIKE ? OR color LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY id DESC`;
    let products = await dbAll(query, params);

    // If requester is a cashier, mask wholesale buy_price to protect business confidentiality
    if (userRole === 'cashier') {
      products = products.map(p => ({
        ...p,
        buy_price: 0
      }));
    }

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new product
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { code, name, category, gender_age, size, color, buy_price, sell_price, stock_quantity, min_stock_alert, image_url_manual } = req.body;

    let image_url = image_url_manual || '';
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }
    if (!image_url) {
      // Default placeholder based on category
      image_url = 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80';
    }

    const prodCode = code || 'GN-' + Date.now().toString().slice(-6);

    const result = await dbRun(`
      INSERT INTO products (code, name, category, gender_age, size, color, buy_price, sell_price, stock_quantity, min_stock_alert, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      prodCode,
      name,
      category || 'Nyinginezo',
      gender_age || 'Unisex',
      size || 'Free Size',
      color || 'Rangi Zote',
      parseFloat(buy_price) || 0,
      parseFloat(sell_price) || 0,
      parseInt(stock_quantity) || 0,
      parseInt(min_stock_alert) || 3,
      image_url
    ]);

    // Record initial purchase entry if stock > 0
    if (parseInt(stock_quantity) > 0) {
      const unitCost = parseFloat(buy_price) || 0;
      await dbRun(`
        INSERT INTO purchases (product_id, supplier_name, quantity, unit_cost, total_cost, notes)
        VALUES (?, 'Kariakoo Stock Intake', ?, ?, ?, 'Mzigo wa awali wa ufunguzi')
      `, [result.id, parseInt(stock_quantity), unitCost, parseInt(stock_quantity) * unitCost]);
    }

    res.json({ success: true, message: 'Bidhaa imeongezwa kikamilifu!', productId: result.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update product
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, category, gender_age, size, color, buy_price, sell_price, stock_quantity, min_stock_alert, image_url_manual } = req.body;

    const existing = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Bidhaa haijapatikana!' });
    }

    const newCode = code ? code.trim() : existing.code;
    const newName = name ? name.trim() : existing.name;
    const newCategory = category || existing.category;
    const newGenderAge = gender_age || existing.gender_age;
    const newSize = (size !== undefined) ? size.trim() : existing.size;
    const newColor = (color !== undefined) ? color.trim() : existing.color;
    const newBuyPrice = (buy_price !== undefined && buy_price !== '') ? parseFloat(buy_price) : existing.buy_price;
    const newSellPrice = (sell_price !== undefined && sell_price !== '') ? parseFloat(sell_price) : existing.sell_price;
    const newStockQty = (stock_quantity !== undefined && stock_quantity !== '') ? parseInt(stock_quantity) : existing.stock_quantity;
    const newMinAlert = (min_stock_alert !== undefined && min_stock_alert !== '') ? parseInt(min_stock_alert) : existing.min_stock_alert;

    let query = `
      UPDATE products 
      SET code = ?, name = ?, category = ?, gender_age = ?, size = ?, color = ?, 
          buy_price = ?, sell_price = ?, stock_quantity = ?, min_stock_alert = ?
    `;
    const params = [
      newCode,
      newName,
      newCategory,
      newGenderAge,
      newSize,
      newColor,
      newBuyPrice,
      newSellPrice,
      newStockQty,
      newMinAlert
    ];

    if (req.file) {
      query += `, image_url = ?`;
      params.push(`/uploads/${req.file.filename}`);
    } else if (image_url_manual !== undefined) {
      query += `, image_url = ?`;
      params.push(image_url_manual.trim() || existing.image_url);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    await dbRun(query, params);
    res.json({ success: true, message: 'Taarifa na bei za bidhaa zimesasishwa kikamilifu!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update product size & color variants
app.put('/api/products/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;
    const { variants } = req.body; // array of { size, color, quantity }
    if (!Array.isArray(variants)) {
      return res.status(400).json({ success: false, message: 'Orodha ya saizi haijakamilika!' });
    }

    const totalStock = variants.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0);
    const variantsJson = JSON.stringify(variants);

    await dbRun(`
      UPDATE products 
      SET variants_json = ?, stock_quantity = ?
      WHERE id = ?
    `, [variantsJson, totalStock, id]);

    res.json({ success: true, message: 'Mgawanyo wa saizi umesasishwa!', totalStock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(`DELETE FROM products WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Bidhaa imefutwa!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. PURCHASES / RESTOCK (MANUNUZI YA MZIGO)
// ==========================================

app.post('/api/purchases', async (req, res) => {
  try {
    const { product_id, supplier_name, quantity, unit_cost, notes } = req.body;
    const qty = parseInt(quantity) || 1;
    const cost = parseFloat(unit_cost) || 0;
    const totalCost = qty * cost;

    const result = await dbRun(`
      INSERT INTO purchases (product_id, supplier_name, quantity, unit_cost, total_cost, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [product_id, supplier_name || 'Kariakoo Wholesaler', qty, cost, totalCost, notes || '']);

    // Increase product stock quantity and update buy price
    await dbRun(`
      UPDATE products 
      SET stock_quantity = stock_quantity + ?, buy_price = ?
      WHERE id = ?
    `, [qty, cost, product_id]);

    res.json({ success: true, message: 'Mzigo mpya umerekodiwa na stoo imeongezeka!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await dbAll(`
      SELECT p.*, pr.name as product_name, pr.code as product_code, pr.category
      FROM purchases p
      LEFT JOIN products pr ON p.product_id = pr.id
      ORDER BY p.purchase_date DESC
    `);
    res.json({ success: true, data: purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. SALES & POS TRANSACTIONS (MAUZO)
// ==========================================

// Create new sale (Cash, Lipa Namba, Layaway, Credit)
app.post('/api/sales', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      items, // array of { product_id, quantity, unit_price }
      discount,
      payment_type, // 'cash', 'lipa_namba', 'layaway', 'credit'
      payment_provider, // 'Cash', 'Tigo Pesa', 'Airtel Money', 'M-Pesa', etc.
      reference_code,
      amount_paid,
      due_date,
      notes,
      cashier_name,
      user_id
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Tafadhali weka angalau bidhaa 1 kwenye kikapu!' });
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const it of items) {
      totalAmount += (parseFloat(it.unit_price) * parseInt(it.quantity));
    }

    const disc = parseFloat(discount) || 0;
    const netAmount = Math.max(0, totalAmount - disc);
    let paid = parseFloat(amount_paid);
    if (isNaN(paid)) {
      paid = (payment_type === 'cash' || payment_type === 'lipa_namba') ? netAmount : 0;
    }
    const balanceDue = Math.max(0, netAmount - paid);

    let status = 'completed';
    if (payment_type === 'layaway') {
      status = balanceDue <= 0 ? 'completed' : 'pending_layaway';
    } else if (payment_type === 'credit') {
      status = balanceDue <= 0 ? 'completed' : 'credit_active';
    }

    const receiptNo = 'GN-' + Date.now().toString().slice(-8);

    // Insert sale header with cashier attribution
    const saleResult = await dbRun(`
      INSERT INTO sales (
        receipt_no, customer_name, customer_phone, total_amount, discount, net_amount,
        payment_type, payment_provider, reference_code, amount_paid, balance_due, status, due_date, notes,
        cashier_name, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      receiptNo,
      customer_name || 'Mteja wa Kawaida',
      customer_phone || '',
      totalAmount,
      disc,
      netAmount,
      payment_type,
      payment_provider || 'Pesa Taslimu (Cash)',
      reference_code || '',
      paid,
      balanceDue,
      status,
      due_date || null,
      notes || '',
      cashier_name || 'Muuzaji',
      user_id || null
    ]);

    const saleId = saleResult.id;

    // Insert sale items and deduct stock
    for (const it of items) {
      const prod = await dbGet(`SELECT name, buy_price FROM products WHERE id = ?`, [it.product_id]);
      const prodName = prod ? prod.name : 'Nguo';
      const unitCost = prod ? prod.buy_price : 0;
      const subtotal = parseFloat(it.unit_price) * parseInt(it.quantity);
      const itemProfit = subtotal - (unitCost * parseInt(it.quantity));

      await dbRun(`
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, subtotal, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [saleId, it.product_id, prodName, parseInt(it.quantity), parseFloat(it.unit_price), unitCost, subtotal, itemProfit]);

      // Deduct stock quantity
      await dbRun(`
        UPDATE products 
        SET stock_quantity = stock_quantity - ?
        WHERE id = ?
      `, [parseInt(it.quantity), it.product_id]);
    }

    // Insert initial installment record if paid > 0 with cashier attribution
    if (paid > 0) {
      await dbRun(`
        INSERT INTO installments (sale_id, amount, payment_type, reference_code, notes, cashier_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [saleId, paid, payment_provider || payment_type, reference_code || '', 'Malipo ya Awali', cashier_name || 'Muuzaji']);
    }

    // Fetch complete sale details for receipt
    const saleData = await dbGet(`SELECT * FROM sales WHERE id = ?`, [saleId]);
    const saleItems = await dbAll(`SELECT * FROM sale_items WHERE sale_id = ?`, [saleId]);

    res.json({
      success: true,
      message: 'Mauzo yamekamilika vizuri!',
      sale: saleData,
      items: saleItems
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get sales list with filters
app.get('/api/sales', async (req, res) => {
  try {
    const { status, payment_type, search, startDate, endDate, limit, cashier_name } = req.query;
    let query = `SELECT * FROM sales WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (payment_type && payment_type !== 'all') {
      query += ` AND payment_type = ?`;
      params.push(payment_type);
    }
    if (cashier_name && cashier_name !== 'all') {
      query += ` AND cashier_name LIKE ?`;
      params.push(`%${cashier_name}%`);
    }
    if (search) {
      query += ` AND (receipt_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR cashier_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (startDate) {
      query += ` AND date(created_at) >= date(?)`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date(created_at) <= date(?)`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC`;
    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    const sales = await dbAll(query, params);
    res.json({ success: true, data: sales });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cashier Shift Sales Summary (Mauzo ya Leo ya Muuzaji)
app.get('/api/sales/my-shift', async (req, res) => {
  try {
    const { cashier_name, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT * FROM sales 
      WHERE date(created_at) = date(?)
    `;
    const params = [targetDate];

    if (cashier_name && cashier_name !== 'all') {
      query += ` AND cashier_name LIKE ?`;
      params.push(`%${cashier_name}%`);
    }
    query += ` ORDER BY created_at DESC`;

    const sales = await dbAll(query, params);

    let totalCollected = 0;
    let cashCollected = 0;
    let lipaNambaCollected = 0;
    let layawayCollected = 0;
    let creditIssued = 0;

    sales.forEach(s => {
      const paid = parseFloat(s.amount_paid) || 0;
      totalCollected += paid;
      if (s.payment_type === 'cash') cashCollected += paid;
      else if (s.payment_type === 'lipa_namba') lipaNambaCollected += paid;
      else if (s.payment_type === 'layaway') layawayCollected += paid;
      else if (s.payment_type === 'credit') creditIssued += (parseFloat(s.net_amount) || 0);
    });

    res.json({
      success: true,
      data: {
        date: targetDate,
        cashier_name: cashier_name || 'Wote',
        totalCollected,
        cashCollected,
        lipaNambaCollected,
        layawayCollected,
        creditIssued,
        salesCount: sales.length,
        sales
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single sale details
app.get('/api/sales/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await dbGet(`SELECT * FROM sales WHERE id = ? OR receipt_no = ?`, [id, id]);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Mauzo hayajapatikana' });
    }

    const items = await dbAll(`SELECT * FROM sale_items WHERE sale_id = ?`, [sale.id]);
    const installments = await dbAll(`SELECT * FROM installments WHERE sale_id = ? ORDER BY paid_at ASC`, [sale.id]);

    res.json({
      success: true,
      data: {
        sale,
        items,
        installments
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add installment payment for Layaway or Credit
app.post('/api/sales/:id/installments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_type, reference_code, notes, cashier_name } = req.body;
    const instAmount = parseFloat(amount) || 0;

    if (instAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Tafadhali weka kiasi halali cha malipo!' });
    }

    const sale = await dbGet(`SELECT * FROM sales WHERE id = ?`, [id]);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Rekodi ya mauzo haijapatikana' });
    }

    const newAmountPaid = sale.amount_paid + instAmount;
    const newBalanceDue = Math.max(0, sale.net_amount - newAmountPaid);

    let newStatus = sale.status;
    if (newBalanceDue <= 0) {
      newStatus = 'completed';
    }

    // Insert installment with cashier attribution
    await dbRun(`
      INSERT INTO installments (sale_id, amount, payment_type, reference_code, notes, cashier_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, instAmount, payment_type || 'Cash', reference_code || '', notes || 'Malipo ya awamu', cashier_name || 'Muuzaji']);

    // Update sale record
    await dbRun(`
      UPDATE sales 
      SET amount_paid = ?, balance_due = ?, status = ?
      WHERE id = ?
    `, [newAmountPaid, newBalanceDue, newStatus, id]);

    res.json({
      success: true,
      message: 'Malipo ya awamu yamepokelewa kikamilifu!',
      newBalanceDue,
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark layaway as delivered to customer
app.post('/api/sales/:id/deliver-layaway', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(`
      UPDATE sales 
      SET status = 'completed', notes = COALESCE(notes, '') || ' [Nguo zimekabidhiwa kwa mteja]'
      WHERE id = ?
    `, [id]);
    res.json({ success: true, message: 'Nguo zimekabidhiwa kwa mteja kikamilifu!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update customer details (phone, name) for receipt/reminders
app.patch('/api/sales/:id/customer', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_phone } = req.body;
    let query = `UPDATE sales SET `;
    const params = [];
    const updates = [];
    if (customer_name !== undefined) {
      updates.push(`customer_name = ?`);
      params.push(customer_name);
    }
    if (customer_phone !== undefined) {
      updates.push(`customer_phone = ?`);
      params.push(customer_phone);
    }
    if (updates.length === 0) {
      return res.json({ success: true, message: 'Hakuna mabadiliko' });
    }
    query += updates.join(', ') + ` WHERE id = ?`;
    params.push(id);
    await dbRun(query, params);
    res.json({ success: true, message: 'Taarifa za mteja zimesasishwa kikamilifu!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3.5 EXPENSES (MATUMIZI YA DUKA)
// ==========================================

// Add new expense
app.post('/api/expenses', async (req, res) => {
  try {
    const { title, category, amount, payment_type, notes } = req.body;
    const expAmount = parseFloat(amount) || 0;
    if (expAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Tafadhali weka kiasi halali cha matumizi!' });
    }

    const result = await dbRun(`
      INSERT INTO expenses (title, category, amount, payment_type, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      title || 'Matumizi ya Kawaida',
      category || 'Nyinginezo',
      expAmount,
      payment_type || 'Cash',
      notes || ''
    ]);

    res.json({ success: true, message: 'Matumizi yamerekodiwa vizuri!', expenseId: result.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get expenses list
app.get('/api/expenses', async (req, res) => {
  try {
    const { category, startDate, endDate, limit } = req.query;
    let query = `SELECT * FROM expenses WHERE 1=1`;
    const params = [];

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }
    if (startDate) {
      query += ` AND date(expense_date) >= date(?)`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date(expense_date) <= date(?)`;
      params.push(endDate);
    }

    query += ` ORDER BY expense_date DESC`;
    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    const expenses = await dbAll(query, params);
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete expense (Admin only)
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const role = req.headers['x-user-role'] || req.query.role;
    if (role === 'cashier') {
      return res.status(403).json({ success: false, message: 'Huna mamlaka ya kufuta matumizi! Ni Mmiliki/Admin tu anayeruhusiwa.' });
    }
    const { id } = req.params;
    await dbRun(`DELETE FROM expenses WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Matumizi yamefutwa!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3.7 IMAGE UPLOAD UTILITY (STANDALONE UPLOAD)
// ==========================================

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tafadhali chagua faili la picha kutoka kwenye kompyuta (PC)!' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Picha imepakiwa kikamilifu!',
      image_url: imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3.8 ODA ZA NGUO ZA WATEJA (CUSTOMER ORDERS)
// ==========================================

// Get all orders with search and status filters
app.get('/api/orders', async (req, res) => {
  try {
    const { status, search, startDate, endDate, targetDate } = req.query;
    let query = `SELECT * FROM orders WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      query += ` AND (order_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR clothing_item LIKE ? OR color LIKE ? OR size LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (startDate) {
      query += ` AND date(created_at) >= date(?)`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date(created_at) <= date(?)`;
      params.push(endDate);
    }
    if (targetDate) {
      query += ` AND date(target_date) = date(?)`;
      params.push(targetDate);
    }

    // Prioritize pending/ordered/arrived first by target_date, then delivered/cancelled
    query += ` ORDER BY 
      CASE 
        WHEN status = 'arrived' THEN 1
        WHEN status = 'pending' THEN 2
        WHEN status = 'ordered' THEN 3
        ELSE 4
      END ASC, 
      target_date ASC, id DESC`;

    const orders = await dbAll(query, params);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Orders KPI Summary
app.get('/api/orders/stats/summary', async (req, res) => {
  try {
    const stats = await dbGet(`
      SELECT 
        COUNT(id) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END), 0) as ordered_count,
        COALESCE(SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END), 0) as arrived_count,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) as delivered_count,
        COALESCE(SUM(advance_paid), 0) as total_advance_collected,
        COALESCE(SUM(CASE WHEN status != 'delivered' AND status != 'cancelled' THEN balance_due ELSE 0 END), 0) as total_balance_due
      FROM orders
    `);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single order with installment payments
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await dbGet(`SELECT * FROM orders WHERE id = ? OR order_no = ?`, [id, id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Oda haijapatikana!' });
    }
    const payments = await dbAll(`SELECT * FROM order_payments WHERE order_id = ? ORDER BY paid_at ASC`, [order.id]);
    res.json({ success: true, data: { order, payments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new customer order (supports PC file upload or online URL)
app.post('/api/orders', upload.single('image'), async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      clothing_item,
      category,
      size,
      color,
      quantity,
      target_date,
      estimated_price,
      advance_paid,
      payment_method,
      notes,
      created_by,
      image_url_manual
    } = req.body;

    if (!customer_name || !customer_phone || !clothing_item || !target_date) {
      return res.status(400).json({
        success: false,
        message: 'Tafadhali jaza Jina la Mteja, Namba ya Simu, Aina ya Nguo na Tarehe ya Ahadi!'
      });
    }

    let image_url = image_url_manual || '';
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }
    if (!image_url) {
      image_url = 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80';
    }

    const estPrice = parseFloat(estimated_price) || 0;
    const advPaid = parseFloat(advance_paid) || 0;
    const balDue = Math.max(0, estPrice - advPaid);
    const qty = parseInt(quantity) || 1;
    const orderNo = 'ORD-' + Date.now().toString().slice(-6);

    const result = await dbRun(`
      INSERT INTO orders (
        order_no, customer_name, customer_phone, clothing_item, category, size, color,
        quantity, target_date, estimated_price, advance_paid, balance_due, payment_method,
        status, image_url, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      orderNo,
      customer_name.trim(),
      customer_phone.trim(),
      clothing_item.trim(),
      category || 'Nyinginezo',
      size ? size.trim() : 'Free Size',
      color ? color.trim() : 'Kama Mfano',
      qty,
      target_date,
      estPrice,
      advPaid,
      balDue,
      payment_method || 'Pesa Taslimu (Cash)',
      image_url,
      notes || '',
      created_by || 'Muuzaji'
    ]);

    const orderId = result.id;

    // If advance paid > 0, record in order_payments
    if (advPaid > 0) {
      await dbRun(`
        INSERT INTO order_payments (order_id, amount, payment_type, notes, cashier_name)
        VALUES (?, ?, ?, 'Malipo ya Awali ya Oda', ?)
      `, [orderId, advPaid, payment_method || 'Cash', created_by || 'Muuzaji']);
    }

    const createdOrder = await dbGet(`SELECT * FROM orders WHERE id = ?`, [orderId]);

    res.json({
      success: true,
      message: `Oda #${orderNo} ya "${customer_name}" imerekodiwa kikamilifu!`,
      data: createdOrder
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update order details (supports PC image re-upload)
app.put('/api/orders/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      customer_phone,
      clothing_item,
      category,
      size,
      color,
      quantity,
      target_date,
      estimated_price,
      status,
      notes,
      image_url_manual
    } = req.body;

    const existing = await dbGet(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Oda haijapatikana!' });
    }

    const newName = customer_name ? customer_name.trim() : existing.customer_name;
    const newPhone = customer_phone ? customer_phone.trim() : existing.customer_phone;
    const newItem = clothing_item ? clothing_item.trim() : existing.clothing_item;
    const newCategory = category || existing.category;
    const newSize = size !== undefined ? size.trim() : existing.size;
    const newColor = color !== undefined ? color.trim() : existing.color;
    const newQty = (quantity !== undefined && quantity !== '') ? parseInt(quantity) : existing.quantity;
    const newTargetDate = target_date || existing.target_date;
    const newEstPrice = (estimated_price !== undefined && estimated_price !== '') ? parseFloat(estimated_price) : existing.estimated_price;
    const newStatus = status || existing.status;
    const newNotes = notes !== undefined ? notes : existing.notes;

    const newBalanceDue = Math.max(0, newEstPrice - existing.advance_paid);

    let query = `
      UPDATE orders 
      SET customer_name = ?, customer_phone = ?, clothing_item = ?, category = ?, 
          size = ?, color = ?, quantity = ?, target_date = ?, estimated_price = ?, 
          balance_due = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    `;
    const params = [
      newName, newPhone, newItem, newCategory,
      newSize, newColor, newQty, newTargetDate, newEstPrice,
      newBalanceDue, newStatus, newNotes
    ];

    if (req.file) {
      query += `, image_url = ?`;
      params.push(`/uploads/${req.file.filename}`);
    } else if (image_url_manual !== undefined && image_url_manual.trim() !== '') {
      query += `, image_url = ?`;
      params.push(image_url_manual.trim());
    }

    query += ` WHERE id = ?`;
    params.push(id);

    await dbRun(query, params);
    res.json({ success: true, message: 'Taarifa za oda zimesasishwa kikamilifu!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Quick update order status (e.g. pending -> ordered -> arrived -> delivered -> cancelled)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const existing = await dbGet(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Oda haijapatikana!' });
    }

    let extraNote = '';
    if (note) extraNote = ` [${note}]`;
    else if (status === 'arrived') extraNote = ` [Imefika Dukani - Tayari Kuchukuliwa]`;
    else if (status === 'delivered') extraNote = ` [Imekabidhiwa kwa Mteja]`;

    await dbRun(`
      UPDATE orders 
      SET status = ?, notes = COALESCE(notes, '') || ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, extraNote, id]);

    res.json({ success: true, message: `Hali ya oda imebadilishwa kuwa "${status}"!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add installment payment for order balance
app.post('/api/orders/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_type, reference_code, notes, cashier_name } = req.body;
    const payAmount = parseFloat(amount) || 0;

    if (payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Tafadhali weka kiasi halali cha malipo!' });
    }

    const order = await dbGet(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Oda haijapatikana!' });
    }

    const newAdvance = order.advance_paid + payAmount;
    const newBalance = Math.max(0, order.estimated_price - newAdvance);

    // Record installment
    await dbRun(`
      INSERT INTO order_payments (order_id, amount, payment_type, reference_code, notes, cashier_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      payAmount,
      payment_type || 'Cash',
      reference_code || '',
      notes || 'Nyongeza ya malipo ya oda',
      cashier_name || 'Muuzaji'
    ]);

    // Update order
    await dbRun(`
      UPDATE orders 
      SET advance_paid = ?, balance_due = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newAdvance, newBalance, id]);

    res.json({
      success: true,
      message: 'Malipo ya oda yamepokelewa kikamilifu!',
      newAdvance,
      newBalance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(`DELETE FROM order_payments WHERE order_id = ?`, [id]);
    await dbRun(`DELETE FROM orders WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Oda imefutwa kikamilifu!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. REPORTS & ANALYTICS (RIPOTI NA GRAFU)
// ==========================================

// Dashboard KPI Summary
app.get('/api/reports/summary', async (req, res) => {
  try {
    // Today's Sales
    const todaySales = await dbGet(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) as total_collected,
        COALESCE(SUM(net_amount), 0) as total_sales,
        COUNT(id) as total_transactions
      FROM sales 
      WHERE date(created_at) = date('now', 'localtime')
    `);

    // Gross Profit Today
    const todayProfit = await dbGet(`
      SELECT COALESCE(SUM(si.profit), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE date(s.created_at) = date('now', 'localtime')
    `);

    // Today's Expenses
    const todayExpenses = await dbGet(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses 
      WHERE date(expense_date) = date('now', 'localtime')
    `);

    // Total Stock Value & Items
    const stockSummary = await dbGet(`
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(stock_quantity), 0) as total_units,
        COALESCE(SUM(stock_quantity * buy_price), 0) as total_stock_value,
        COALESCE(SUM(stock_quantity * sell_price), 0) as expected_revenue
      FROM products
    `);

    // Outstanding Credit (Madeni ya mikopo)
    const creditSummary = await dbGet(`
      SELECT 
        COALESCE(SUM(balance_due), 0) as total_credit_due,
        COUNT(id) as active_debtors
      FROM sales 
      WHERE payment_type = 'credit' AND status = 'credit_active'
    `);

    // Active Layaway (Akiba zinazoendelea)
    const layawaySummary = await dbGet(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) as total_layaway_deposited,
        COALESCE(SUM(balance_due), 0) as total_layaway_pending,
        COUNT(id) as active_layaways
      FROM sales 
      WHERE payment_type = 'layaway' AND status = 'pending_layaway'
    `);

    // Low stock count
    const lowStock = await dbGet(`
      SELECT COUNT(id) as count FROM products WHERE stock_quantity <= min_stock_alert
    `);

    // Collections Today across Direct Sales, Layaway (Wanaowekeza), and Credit Repayments (Mikopo)
    const collectionsToday = await dbAll(`
      SELECT 
        s.payment_type as sale_type,
        COALESCE(SUM(i.amount), 0) as total,
        COUNT(i.id) as count
      FROM installments i
      JOIN sales s ON i.sale_id = s.id
      WHERE date(i.paid_at) = date('now', 'localtime')
      GROUP BY s.payment_type
    `);

    let todayDirectSales = 0;
    let todayLayawayCollected = 0;
    let todayCreditCollected = 0;
    let totalCollectionsCount = 0;

    collectionsToday.forEach(c => {
      totalCollectionsCount += c.count;
      if (c.sale_type === 'layaway') {
        todayLayawayCollected += c.total;
      } else if (c.sale_type === 'credit') {
        todayCreditCollected += c.total;
      } else {
        todayDirectSales += c.total;
      }
    });

    const orderPaymentsToday = await dbGet(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(id) as count
      FROM order_payments
      WHERE date(paid_at) = date('now', 'localtime')
    `);
    const todayOrdersCollected = orderPaymentsToday?.total || 0;
    const todayTotalInflow = todayDirectSales + todayLayawayCollected + todayCreditCollected + todayOrdersCollected;

    const grossProfit = todayProfit.profit || 0;
    const expTotal = todayExpenses.total || 0;
    const netProfit = grossProfit - expTotal;

    res.json({
      success: true,
      data: {
        todaySales: todaySales.total_collected,
        todayTransactions: todaySales.total_transactions,
        todayTotalInflow,
        todayDirectSales,
        todayLayawayCollected,
        todayCreditCollected,
        todayOrdersCollected,
        todayCollectionsCount: totalCollectionsCount + (orderPaymentsToday?.count || 0),
        todayGrossProfit: grossProfit,
        todayExpenses: expTotal,
        todayProfit: netProfit,
        totalProducts: stockSummary.total_products,
        totalUnits: stockSummary.total_units,
        totalStockValue: stockSummary.total_stock_value,
        expectedRevenue: stockSummary.expected_revenue,
        totalCreditDue: creditSummary.total_credit_due,
        activeDebtors: creditSummary.active_debtors,
        layawayDeposited: layawaySummary.total_layaway_deposited,
        layawayPending: layawaySummary.total_layaway_pending,
        activeLayaways: layawaySummary.active_layaways,
        lowStockCount: lowStock.count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint mahsusi ya Mapato ya Siku (Daily Collections & Inflow Breakdown)
app.get('/api/reports/daily-revenue', async (req, res) => {
  try {
    const reportDate = req.query.date || new Date().toISOString().split('T')[0];

    // 1. Installments & Payments collected on this date
    const installments = await dbAll(`
      SELECT 
        i.id,
        i.sale_id,
        i.amount,
        i.payment_type,
        i.reference_code,
        i.notes,
        i.cashier_name,
        i.paid_at,
        s.receipt_no,
        s.customer_name,
        s.customer_phone,
        s.payment_type as sale_payment_type,
        s.total_amount as sale_total,
        s.amount_paid as sale_amount_paid,
        s.balance_due as sale_balance_due,
        s.status as sale_status
      FROM installments i
      JOIN sales s ON i.sale_id = s.id
      WHERE date(i.paid_at) = date(?)
      ORDER BY i.paid_at DESC
    `, [reportDate]);

    // 2. Order payments on this date
    const orderPayments = await dbAll(`
      SELECT 
        op.id,
        op.order_id,
        op.amount,
        op.payment_type,
        op.reference_code,
        op.notes,
        op.cashier_name,
        op.paid_at,
        o.order_no as receipt_no,
        o.customer_name,
        o.customer_phone,
        'order' as sale_payment_type,
        o.estimated_price as sale_total,
        o.advance_paid as sale_amount_paid,
        o.balance_due as sale_balance_due,
        o.status as sale_status
      FROM order_payments op
      JOIN orders o ON op.order_id = o.id
      WHERE date(op.paid_at) = date(?)
      ORDER BY op.paid_at DESC
    `, [reportDate]);

    // Combine all collections
    let directSalesTotal = 0;
    let directSalesCount = 0;

    let layawayTotal = 0;
    let layawayCount = 0;

    let creditTotal = 0;
    let creditCount = 0;

    let ordersTotal = 0;
    let ordersCount = 0;

    // Payment methods aggregation (Cash, Tigo, Airtel, etc.)
    const paymentMethods = {
      cash: 0,
      tigo_pesa: 0,
      airtel_money: 0,
      other: 0
    };

    const categorizePayment = (method, amount) => {
      const m = (method || '').toLowerCase();
      if (m.includes('cash') || m.includes('taslimu')) {
        paymentMethods.cash += amount;
      } else if (m.includes('tigo')) {
        paymentMethods.tigo_pesa += amount;
      } else if (m.includes('airtel')) {
        paymentMethods.airtel_money += amount;
      } else {
        paymentMethods.other += amount;
      }
    };

    const transactions = [];

    installments.forEach(inst => {
      const amt = parseFloat(inst.amount) || 0;
      categorizePayment(inst.payment_type, amt);

      let category = 'Mauzo ya Moja kwa Moja';
      let categoryBadge = 'badge-success';

      if (inst.sale_payment_type === 'layaway') {
        category = 'Kuwekeza Kidogo Kidogo (Akiba)';
        categoryBadge = 'badge-purple';
        layawayTotal += amt;
        layawayCount++;
      } else if (inst.sale_payment_type === 'credit') {
        category = 'Marejesho ya Mkopo / Deni';
        categoryBadge = 'badge-warning';
        creditTotal += amt;
        creditCount++;
      } else {
        category = 'Mauzo ya Moja kwa Moja';
        categoryBadge = 'badge-gold';
        directSalesTotal += amt;
        directSalesCount++;
      }

      transactions.push({
        id: `inst-${inst.id}`,
        type: category,
        type_code: inst.sale_payment_type,
        badge_class: categoryBadge,
        receipt_no: inst.receipt_no,
        customer_name: inst.customer_name || 'Mteja wa Kawaida',
        customer_phone: inst.customer_phone || '-',
        amount: amt,
        payment_method: inst.payment_type || 'Cash',
        reference_code: inst.reference_code || '-',
        cashier_name: inst.cashier_name || 'Muuzaji',
        notes: inst.notes || '',
        paid_at: inst.paid_at
      });
    });

    orderPayments.forEach(op => {
      const amt = parseFloat(op.amount) || 0;
      ordersTotal += amt;
      ordersCount++;
      categorizePayment(op.payment_type, amt);

      transactions.push({
        id: `ord-${op.id}`,
        type: 'Malipo ya Oda Maalum',
        type_code: 'order',
        badge_class: 'badge-cyan',
        receipt_no: op.receipt_no,
        customer_name: op.customer_name || 'Mteja wa Oda',
        customer_phone: op.customer_phone || '-',
        amount: amt,
        payment_method: op.payment_type || 'Cash',
        reference_code: op.reference_code || '-',
        cashier_name: op.cashier_name || 'Muuzaji',
        notes: op.notes || 'Malipo ya oda',
        paid_at: op.paid_at
      });
    });

    // Sort combined transactions by timestamp descending
    transactions.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));

    // Expenses for this date
    const expenses = await dbAll(`
      SELECT id, title, category, amount, payment_type, expense_date, notes
      FROM expenses
      WHERE date(expense_date) = date(?)
      ORDER BY expense_date DESC
    `, [reportDate]);

    let expensesTotal = 0;
    expenses.forEach(e => expensesTotal += (parseFloat(e.amount) || 0));

    const totalInflow = directSalesTotal + layawayTotal + creditTotal + ordersTotal;
    const netCashBalance = totalInflow - expensesTotal;

    res.json({
      success: true,
      data: {
        date: reportDate,
        totalInflow,
        directSalesTotal,
        directSalesCount,
        layawayTotal,
        layawayCount,
        creditTotal,
        creditCount,
        ordersTotal,
        ordersCount,
        totalTransactionsCount: transactions.length,
        paymentMethods,
        expensesTotal,
        netCashBalance,
        transactions,
        expenses
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// End of Day Z-Report (Kufunga Hesabu za Siku)
app.get('/api/reports/z-report', async (req, res) => {
  try {
    const reportDate = req.query.date || new Date().toISOString().split('T')[0];

    // 1. All collections today from installments (includes initial payments recorded as installments)
    const installmentsToday = await dbAll(`
      SELECT payment_type, COALESCE(SUM(amount), 0) as total, COUNT(id) as count
      FROM installments
      WHERE date(paid_at) = date(?)
      GROUP BY payment_type
    `, [reportDate]);

    // Categorize payments into Cash, Tigo Pesa, Airtel Money, Others
    let cashIn = 0;
    let tigoIn = 0;
    let airtelIn = 0;
    let otherIn = 0;

    installmentsToday.forEach(inst => {
      const p = (inst.payment_type || '').toLowerCase();
      if (p.includes('cash') || p.includes('taslimu')) {
        cashIn += inst.total;
      } else if (p.includes('tigo')) {
        tigoIn += inst.total;
      } else if (p.includes('airtel')) {
        airtelIn += inst.total;
      } else {
        otherIn += inst.total;
      }
    });

    // 2. Total sales net value and transaction count
    const salesSummary = await dbGet(`
      SELECT 
        COUNT(id) as total_sales_count,
        COALESCE(SUM(total_amount), 0) as total_gross_sales,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(net_amount), 0) as total_net_sales,
        COALESCE(SUM(amount_paid), 0) as total_paid_now,
        COALESCE(SUM(balance_due), 0) as total_balance_due
      FROM sales
      WHERE date(created_at) = date(?)
    `, [reportDate]);

    // 3. Clothes units sold & profit
    const itemsSummary = await dbGet(`
      SELECT 
        COALESCE(SUM(si.quantity), 0) as total_units_sold,
        COALESCE(SUM(si.profit), 0) as gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE date(s.created_at) = date(?)
    `, [reportDate]);

    // 4. Expenses breakdown
    const expensesToday = await dbAll(`
      SELECT payment_type, COALESCE(SUM(amount), 0) as total, COUNT(id) as count
      FROM expenses
      WHERE date(expense_date) = date(?)
      GROUP BY payment_type
    `, [reportDate]);

    let cashOut = 0;
    let digitalOut = 0;
    expensesToday.forEach(exp => {
      const p = (exp.payment_type || '').toLowerCase();
      if (p.includes('cash') || p.includes('taslimu') || p.includes('drooni')) {
        cashOut += exp.total;
      } else {
        digitalOut += exp.total;
      }
    });

    const totalExpenses = cashOut + digitalOut;
    const totalCollected = cashIn + tigoIn + airtelIn + otherIn;
    const expectedDrawerCash = Math.max(0, cashIn - cashOut);
    const grossProfit = itemsSummary.gross_profit || 0;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        date: reportDate,
        salesCount: salesSummary.total_sales_count || 0,
        unitsSold: itemsSummary.total_units_sold || 0,
        grossSales: salesSummary.total_gross_sales || 0,
        discount: salesSummary.total_discount || 0,
        netSales: salesSummary.total_net_sales || 0,
        totalCollected,
        cashIn,
        cashOut,
        expectedDrawerCash,
        tigoIn,
        airtelIn,
        otherIn,
        digitalExpenses: digitalOut,
        totalExpenses,
        grossProfit,
        netProfit,
        creditIssuedToday: salesSummary.total_balance_due || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Sales Trends (Daily, Monthly, Yearly for Chart.js)
app.get('/api/reports/trends', async (req, res) => {
  try {
    const { period } = req.query; // '7days', '30days', 'months', 'years'

    let query = '';
    if (period === 'years') {
      query = `
        SELECT 
          strftime('%Y', s.created_at) as label,
          COALESCE(SUM(s.net_amount), 0) as revenue,
          COALESCE(SUM(si.profit), 0) as profit,
          COUNT(DISTINCT s.id) as orders
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        GROUP BY strftime('%Y', s.created_at)
        ORDER BY label ASC
      `;
    } else if (period === 'months') {
      query = `
        SELECT 
          strftime('%Y-%m', s.created_at) as label,
          COALESCE(SUM(s.net_amount), 0) as revenue,
          COALESCE(SUM(si.profit), 0) as profit,
          COUNT(DISTINCT s.id) as orders
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE date(s.created_at) >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', s.created_at)
        ORDER BY label ASC
      `;
    } else if (period === '30days') {
      query = `
        SELECT 
          strftime('%d/%m', s.created_at) as label,
          COALESCE(SUM(s.net_amount), 0) as revenue,
          COALESCE(SUM(si.profit), 0) as profit,
          COUNT(DISTINCT s.id) as orders
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE date(s.created_at) >= date('now', '-30 days')
        GROUP BY strftime('%Y-%m-%d', s.created_at)
        ORDER BY strftime('%Y-%m-%d', s.created_at) ASC
      `;
    } else {
      // Default: Last 7 days
      query = `
        SELECT 
          strftime('%d/%m', s.created_at) as label,
          COALESCE(SUM(s.net_amount), 0) as revenue,
          COALESCE(SUM(si.profit), 0) as profit,
          COUNT(DISTINCT s.id) as orders
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE date(s.created_at) >= date('now', '-7 days')
        GROUP BY strftime('%Y-%m-%d', s.created_at)
        ORDER BY strftime('%Y-%m-%d', s.created_at) ASC
      `;
    }

    const data = await dbAll(query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Category Performance
app.get('/api/reports/categories', async (req, res) => {
  try {
    const data = await dbAll(`
      SELECT 
        p.category,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.subtotal), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Store Settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbAll(`SELECT * FROM store_settings`);
    const formatted = {};
    settings.forEach(s => { formatted[s.key] = s.value; });
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const keys = Object.keys(req.body);
    for (const k of keys) {
      await dbRun(`
        INSERT INTO store_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [k, req.body[k]]);
    }
    res.json({ success: true, message: 'Mipangilio imehifadhiwa!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 6. DATABASE BACKUP & RESTORE
// ==========================================

const dbFilePath = path.join(__dirname, 'glownest.db');

// Download Database Backup
app.get('/api/backup', (req, res) => {
  if (!fs.existsSync(dbFilePath)) {
    return res.status(404).json({ success: false, message: 'Database haijapatikana!' });
  }
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `glownest-backup-${dateStr}.db`;
  res.download(dbFilePath, filename, (err) => {
    if (err) {
      console.error('Error downloading backup:', err);
    }
  });
});

// Restore Database Backup
const restoreStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, __dirname),
  filename: (req, file, cb) => cb(null, 'temp_restore.db')
});
const restoreUpload = multer({ storage: restoreStorage });

app.post('/api/restore', restoreUpload.single('db_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tafadhali chagua faili la database (.db)!' });
    }

    const tempPath = path.join(__dirname, 'temp_restore.db');
    const backupOldPath = path.join(__dirname, `glownest-auto-old-${Date.now()}.db.bak`);

    // Backup current db first
    if (fs.existsSync(dbFilePath)) {
      fs.copyFileSync(dbFilePath, backupOldPath);
    }

    // Overwrite with uploaded db
    fs.copyFileSync(tempPath, dbFilePath);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    res.json({
      success: true,
      message: 'Database imerudishwa kikamilifu! Mfumo sasa una taarifa mpya.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`GLOWNEST Smart Wear Server inafanya kazi kwenye http://localhost:${PORT}`);
});
