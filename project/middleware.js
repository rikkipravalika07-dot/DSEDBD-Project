import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication token required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
