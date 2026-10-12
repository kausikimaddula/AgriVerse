import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const getSecret = () => process.env.JWT_SECRET || 'agriverse_super_secret_jwt_key_2026';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. Missing Bearer authorization token.'
    });
  }

  try {
    const verified = jwt.verify(token, getSecret());
    req.admin = verified;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired authorization token.'
    });
  }
}

export function generateToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}
