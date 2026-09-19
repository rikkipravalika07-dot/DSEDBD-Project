import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'expense_splitter',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
};

export const pool = mysql.createPool(config);

export async function initializeDatabase() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD is empty. Run setup.ps1 in the backend folder and enter your MySQL password, or create backend/.env.');
  }
  // Make sure the database itself exists.
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  await bootstrap.end();

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS groups_table (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      type VARCHAR(50) DEFAULT 'Friends',
      description VARCHAR(255),
      created_by BIGINT UNSIGNED NOT NULL,
      budget DECIMAL(12,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS group_members (
      group_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id,user_id),
      FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      group_id BIGINT UNSIGNED NULL,
      title VARCHAR(150) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      expense_date DATE NOT NULL,
      category VARCHAR(50) NOT NULL,
      notes VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS expense_splits (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      expense_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      share_amount DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS budgets (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      group_id BIGINT UNSIGNED NULL,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(50) NOT NULL,
      limit_amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settlements (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      group_id BIGINT UNSIGNED NULL,
      from_user_id BIGINT UNSIGNED NOT NULL,
      to_user_id BIGINT UNSIGNED NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pending','settled') DEFAULT 'settled',
      settled_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE SET NULL,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(60) NOT NULL,
      text VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id,category)`,
    `CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id,read_at)`
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      // MySQL versions that don't support CREATE INDEX IF NOT EXISTS may throw
      // for existing indexes. Tables must still be created successfully.
      if (!sql.includes('CREATE INDEX IF NOT EXISTS')) throw err;
    }
  }

  await pool.query('SELECT 1');
}
