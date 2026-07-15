const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'nes-emulator-secret-key-2024';

/**
 * JWT 认证中间件
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query(
      'SELECT id, username, email, nickname, avatar, role, status FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ code: 401, message: '用户不存在' });
    }

    if (rows[0].status === 'banned') {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
}

/**
 * 可选认证中间件（有 token 就解析，没有也放行）
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query(
      'SELECT id, username, email, nickname, avatar, role, status FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (rows.length > 0 && rows[0].status === 'active') {
      req.user = rows[0];
    }
  } catch (err) {
    // token 无效也继续
  }
  next();
}

/**
 * 管理员权限中间件
 */
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限' });
  }
  next();
}

module.exports = { authMiddleware, optionalAuth, adminMiddleware, JWT_SECRET };
