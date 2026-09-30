/**
 * JWT authentication middleware for the new feature routes (receipts,
 * personality, llm, monitoring). Requires a valid Bearer token. No demo
 * fallback — real mode only.
 */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function authenticateJWTOrDemo(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token required' });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: 'Server missing JWT_SECRET' });
    }
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User account inactive' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export default { authenticateJWTOrDemo };
