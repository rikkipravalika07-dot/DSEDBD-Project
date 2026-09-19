import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool, initializeDatabase } from './db.js';
import { auth } from './middleware.js';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'Expense Splitter API', database: 'connected' }); }
  catch (e) { res.status(503).json({ ok: false, service: 'Expense Splitter API', database: 'not connected', message: e.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length) return res.status(409).json({ message: 'An account with this email already exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name.trim(), email.trim().toLowerCase(), passwordHash]);
    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase() };
    res.status(201).json({ user, token: tokenFor(user) });
  } catch (e) { console.error('REGISTER ERROR:', e); res.status(500).json({ message: 'Registration failed', detail: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email?.trim().toLowerCase()]);
    if (!rows.length || !(await bcrypt.compare(password || '', rows[0].password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
    const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email };
    res.json({ user, token: tokenFor(user) });
  } catch (e) { console.error('LOGIN ERROR:', e); res.status(500).json({ message: 'Login failed', detail: e.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json({ user: rows[0] });
});

app.get('/api/budgets', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT b.id,b.name,b.category,b.limit_amount AS budgetLimit,b.group_id AS groupId,b.created_at FROM budgets b WHERE b.user_id=? ORDER BY b.created_at DESC', [req.user.id]);
  for (const b of rows) {
    b.limit = Number(b.budgetLimit || 0); delete b.budgetLimit;
    const [sum] = await pool.query(`SELECT COALESCE(SUM(e.amount),0) spent FROM expenses e WHERE e.user_id=? AND e.category=? AND (? IS NULL OR e.group_id=?)`, [req.user.id, b.category, b.groupId, b.groupId]);
    b.spent = Number(sum[0].spent || 0);
  }
  res.json({ budgets: rows });
});

app.post('/api/budgets', auth, async (req, res) => {
  try {
    const { name, groupId = null, category, limit } = req.body;
    if (!name || !category || !Number(limit) || Number(limit) <= 0) return res.status(400).json({ message: 'Enter a budget name, category and positive limit' });
    const [result] = await pool.query('INSERT INTO budgets (user_id, group_id, name, category, limit_amount) VALUES (?,?,?,?,?)', [req.user.id, groupId, name.trim(), category, Number(limit)]);
    res.status(201).json({ budget: { id: result.insertId, name, groupId, category, limit: Number(limit), spent: 0 } });
  } catch (e) { res.status(500).json({ message: 'Could not create budget', detail: e.message }); }
});

app.delete('/api/budgets/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM budgets WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

app.get('/api/expenses', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT id,title,amount,expense_date AS date,category,group_id AS groupId,notes FROM expenses WHERE user_id=? ORDER BY expense_date DESC,id DESC', [req.user.id]);
  res.json({ expenses: rows });
});

app.post('/api/expenses', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { title, amount, date, category, groupId = null, notes = '' } = req.body;
    if (!title || !Number(amount) || Number(amount) <= 0 || !category) return res.status(400).json({ message: 'Expense title, positive amount and category are required' });
    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO expenses (user_id,title,amount,expense_date,category,group_id,notes) VALUES (?,?,?,?,?,?,?)', [req.user.id,title.trim(),Number(amount),date || new Date(),category,groupId,notes]);
    const alerts=[];
    const [budgets] = await conn.query('SELECT id,name,category,limit_amount,group_id FROM budgets WHERE user_id=? AND category=?', [req.user.id, category]);
    for (const b of budgets) {
      const [spentRows] = await conn.query('SELECT COALESCE(SUM(amount),0) spent FROM expenses WHERE user_id=? AND category=? AND (? IS NULL OR group_id=?)', [req.user.id, b.category, b.group_id, b.group_id]);
      const spent=Number(spentRows[0].spent||0); const pct=spent/Number(b.limit_amount)*100;
      if (pct>=80) {
        const exceeded=spent-Number(b.limit_amount);
        const text=exceeded>0 ? `🚨 ${b.name}: budget exceeded by ₹${Math.round(exceeded)}.` : `⚠️ ${b.name}: ${Math.round(pct)}% of your budget is used.`;
        const type=exceeded>0?'Budget Exceeded':'Budget Alert';
        await conn.query('INSERT INTO notifications (user_id,type,text) VALUES (?,?,?)',[req.user.id,type,text]);
        alerts.push({name:b.name,spent,limit:Number(b.limit_amount),percentage:pct,exceeded:Math.max(0,exceeded),text});
      }
    }
    await conn.commit();
    res.status(201).json({ expense:{id:result.insertId,title,amount:Number(amount),date,category,groupId,notes}, alerts });
  } catch(e) { await conn.rollback(); res.status(500).json({message:'Could not save expense',detail:e.message}); }
  finally { conn.release(); }
});

app.get('/api/notifications', auth, async (req,res)=>{
  const [rows]=await pool.query('SELECT id,type,text,created_at AS time,read_at IS NOT NULL AS seen FROM notifications WHERE user_id=? ORDER BY created_at DESC',[req.user.id]);
  res.json({notifications:rows});
});
app.patch('/api/notifications/:id/read', auth, async (req,res)=>{
  await pool.query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  res.json({ok:true});
});
app.patch('/api/notifications/read-all', auth, async (req,res)=>{
  await pool.query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=?',[req.user.id]);
  res.json({ok:true});
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Expense Splitter API running at http://localhost:${PORT}`);
      console.log('MySQL database connected and tables are ready.');
    });
  } catch (error) {
    console.error('\nDATABASE STARTUP ERROR');
    console.error(error.message);
    console.error('Check backend/.env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
    process.exit(1);
  }
}

startServer();
