-- ========================================================
-- GLOWNEST SMART WEAR - TiDB Cloud Database Schema
-- ========================================================

-- 1. Tengeneza na chagua database
CREATE DATABASE IF NOT EXISTS glownest_db;
USE glownest_db;

-- 2. Jedwali la Bidhaa (Products)
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
);

-- 3. Jedwali la Manunuzi / Stock In (Purchases)
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  supplier_name VARCHAR(255),
  quantity INT NOT NULL,
  unit_cost DECIMAL(12, 2) NOT NULL,
  total_cost DECIMAL(12, 2) NOT NULL,
  purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. Jedwali la Watumiaji / Staff (Users)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_pin VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'cashier',
  phone VARCHAR(50),
  is_active INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Jedwali la Mauzo (Sales)
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
);

-- 6. Jedwali la Vipengele vya Mauzo (Sale Items)
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
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 7. Jedwali la Malipo ya Awamu (Installments)
CREATE TABLE IF NOT EXISTS installments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  reference_code VARCHAR(100),
  cashier_name VARCHAR(100) DEFAULT 'CASHIER',
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- 8. Jedwali la Mipangilio ya Duka (Store Settings)
CREATE TABLE IF NOT EXISTS store_settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT
);

-- 9. Jedwali la Matumizi ya Duka (Expenses)
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'Cash',
  expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- 10. Jedwali la Oda Maalum za Nguo (Orders)
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
);

-- 11. Malipo ya Awamu ya Oda (Order Payments)
CREATE TABLE IF NOT EXISTS order_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  reference_code VARCHAR(100),
  notes TEXT,
  cashier_name VARCHAR(100) DEFAULT 'CASHIER',
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 12. Weka Watumiaji wa Awali (Admin PIN: 1234, Cashier PIN: 0000)
INSERT INTO users (username, password_pin, full_name, role, phone)
VALUES 
  ('admin', '1234', 'ABISHAI EVARISTO NGENZI (Mmiliki)', 'admin', '0656392400'),
  ('muuzaji', '0000', 'CASHIER', 'cashier', '0685073565')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- 13. Weka Mipangilio ya Awali ya Duka
INSERT INTO store_settings (`key`, `value`) VALUES
  ('store_name', 'GLOWNEST Smart Wear'),
  ('owner_name', 'ABISHAI EVARISTO NGENZI'),
  ('store_tagline', 'Mitindo na Nguo Bora za Kisasa Kutoka Kariakoo'),
  ('store_phone', '0656392400 / 0685073565'),
  ('store_phone_primary', '0656392400'),
  ('store_phone_secondary', '0685073565'),
  ('tigo_lipa_number', '44834912'),
  ('tigo_lipa_name', 'ABISHAI'),
  ('airtel_lipa_number', '136541343'),
  ('airtel_lipa_name', 'DORCAS'),
  ('store_location', 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ'),
  ('store_logo', '/assets/logo.png'),
  ('currency', 'TZS')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
