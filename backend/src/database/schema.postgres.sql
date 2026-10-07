-- ============================================================
-- GesLo — Schéma de base de données PostgreSQL pour Supabase
-- ============================================================

-- Rôles utilisateurs
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id),
  commission_rate NUMERIC DEFAULT 0,
  commission_type VARCHAR(50) DEFAULT 'percentage',
  is_active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Paramètres de l'établissement
CREATE TABLE IF NOT EXISTS business_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'Mon Commerce',
  address TEXT,
  phone VARCHAR(100),
  email VARCHAR(255),
  currency VARCHAR(50) DEFAULT 'FCFA',
  currency_symbol VARCHAR(50) DEFAULT 'FCFA',
  date_format VARCHAR(50) DEFAULT 'DD/MM/YYYY',
  business_type VARCHAR(50) DEFAULT 'shop',
  logo_path TEXT,
  tax_rate NUMERIC DEFAULT 0,
  allow_negative_stock INT DEFAULT 0,
  enable_commissions INT DEFAULT 0,
  pool_commission_rate NUMERIC DEFAULT 0,
  receipt_footer TEXT DEFAULT 'Merci de votre visite !',
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Catégories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(50) DEFAULT '#4f46e5',
  is_active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  note TEXT,
  balance_due NUMERIC DEFAULT 0,
  is_active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Clients
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  address TEXT,
  total_purchases NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  last_transaction_at TIMESTAMPTZ,
  is_active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Produits
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  reference VARCHAR(255) UNIQUE,
  barcode VARCHAR(255),
  category_id INT REFERENCES categories(id),
  unit VARCHAR(50) DEFAULT 'pièce',
  unit_quantity INT DEFAULT NULL,
  purchase_price NUMERIC DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  stock_quantity NUMERIC DEFAULT 0,
  alert_threshold INT DEFAULT 5,
  supplier_id INT REFERENCES suppliers(id),
  image_path TEXT,
  is_active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  type VARCHAR(50) NOT NULL CHECK(type IN (
    'initial','purchase','sale','return_customer','return_supplier',
    'loss','damaged','manual_correction','kitchen_consumption'
  )),
  quantity NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  reference_id INT,
  reference_type VARCHAR(100),
  note TEXT,
  user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ventes
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  sale_number VARCHAR(255) NOT NULL UNIQUE,
  user_id INT NOT NULL REFERENCES users(id),
  customer_id INT REFERENCES customers(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'cash' CHECK(payment_method IN (
    'cash','tmoney','flooz','card','credit','mixed'
  )),
  status VARCHAR(50) DEFAULT 'completed' CHECK(status IN ('completed','cancelled','pending')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Articles d'une vente
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  purchase_price NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL
);

-- Achats fournisseurs
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  purchase_number VARCHAR(255) NOT NULL UNIQUE,
  supplier_id INT REFERENCES suppliers(id),
  user_id INT NOT NULL REFERENCES users(id),
  total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'completed' CHECK(status IN ('completed','pending','cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Articles d'un achat
CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL
);

-- Catégories de dépenses
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT
);

-- Dépenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  category_id INT REFERENCES expense_categories(id),
  amount NUMERIC NOT NULL CHECK(amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id INT NOT NULL REFERENCES users(id),
  note TEXT,
  receipt_path TEXT,
  is_deleted INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Journal des actions sensibles
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity VARCHAR(255),
  entity_id INT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tables restaurant
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  number INT NOT NULL UNIQUE,
  name VARCHAR(255),
  capacity INT DEFAULT 4,
  status VARCHAR(50) DEFAULT 'available' CHECK(status IN ('available','occupied','reserved')),
  is_active INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(255) NOT NULL UNIQUE,
  table_id INT REFERENCES restaurant_tables(id),
  user_id INT NOT NULL REFERENCES users(id),
  customer_id INT REFERENCES customers(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK(status IN (
    'draft','pending','preparing','ready','served','paid','cancelled'
  )),
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  payment_method VARCHAR(50),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending','preparing','ready','served')),
  note TEXT
);

-- Recettes (ingrédients d'un plat)
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL UNIQUE REFERENCES products(id),
  name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id SERIAL PRIMARY KEY,
  recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES products(id),
  quantity NUMERIC NOT NULL,
  unit VARCHAR(50)
);

-- Clôtures journalières
CREATE TABLE IF NOT EXISTS day_closings (
  id SERIAL PRIMARY KEY,
  closing_date DATE NOT NULL UNIQUE,
  sale_count INT DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  expenses NUMERIC DEFAULT 0,
  total_discount NUMERIC DEFAULT 0,
  closed_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Traçabilité des commissions sur les ventes
CREATE TABLE IF NOT EXISTS sale_commissions (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  sale_total NUMERIC NOT NULL DEFAULT 0,
  sale_profit NUMERIC NOT NULL DEFAULT 0,
  user_commission NUMERIC NOT NULL DEFAULT 0,
  pool_commission NUMERIC NOT NULL DEFAULT 0,
  total_commission NUMERIC NOT NULL DEFAULT 0,
  caisse_net NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Données initiales par défaut : Rôles et Administrateur principal
INSERT INTO roles (id, name, description)
VALUES 
  (1, 'admin', 'Administrateur avec tous les privilèges'),
  (2, 'manager', 'Gérant avec accès aux rapports et gestion'),
  (3, 'caissier', 'Caissier avec accès à la caisse uniquement'),
  (4, 'cuisinier', 'Cuisinier avec accès à la cuisine/commandes')
ON CONFLICT (id) DO NOTHING;

-- Mot de passe par défaut : admin123 (hash bcrypt)
INSERT INTO users (id, username, password_hash, full_name, role_id)
VALUES (1, 'admin', '$2a$10$wT8KjTz6V7/2lVj5/Jv9/eO6HlGq0d6/d/X.1X.Y1Z1A1B1C1D1E1', 'Administrateur', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_settings (id, name)
VALUES (1, 'GesLo Commerce')
ON CONFLICT (id) DO NOTHING;
