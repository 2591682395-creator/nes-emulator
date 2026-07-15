const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const User = require('../models/user');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { success, error } = require('../utils/response');

const router = express.Router();

// POST /api/auth/register - 注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;

    if (!username || !email || !password) {
      return error(res, '用户名、邮箱和密码不能为空');
    }
    if (username.length < 3 || username.length > 20) {
      return error(res, '用户名长度需为 3-20 个字符');
    }
    if (password.length < 6) {
      return error(res, '密码长度不能少于 6 个字符');
    }

    // 检查是否允许注册
    const [settings] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'allow_register'");
    if (settings.length > 0 && settings[0].setting_value === 'false') {
      return error(res, '暂未开放注册', 403, 403);
    }

    // 检查用户名/邮箱唯一性
    if (await User.findByUsername(username)) {
      return error(res, '用户名已被注册');
    }
    if (await User.findByEmail(email)) {
      return error(res, '邮箱已被注册');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = await User.create({ username, email, password_hash, nickname });

    // 生成 token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    success(res, {
      token,
      user: { id: userId, username, email, nickname: nickname || username, role: 'user' },
    }, '注册成功');
  } catch (err) {
    console.error('注册错误:', err);
    error(res, '注册失败', 500, 500);
  }
});

// POST /api/auth/login - 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空');
    }

    // 支持用户名或邮箱登录
    let user = await User.findByUsername(username);
    if (!user) {
      user = await User.findByEmail(username);
    }
    if (!user) {
      return error(res, '用户名或密码错误');
    }

    if (user.status === 'banned') {
      return error(res, '账号已被禁用', 403, 403);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return error(res, '用户名或密码错误');
    }

    await User.updateLastLogin(user.id);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
      },
    }, '登录成功');
  } catch (err) {
    console.error('登录错误:', err);
    error(res, '登录失败', 500, 500);
  }
});

// GET /api/auth/profile - 获取当前用户信息
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    success(res, user);
  } catch (err) {
    error(res, '获取用户信息失败', 500, 500);
  }
});

// PUT /api/auth/profile - 更新个人信息
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    await User.updateProfile(req.user.id, { nickname, avatar });
    const user = await User.findById(req.user.id);
    success(res, user, '更新成功');
  } catch (err) {
    error(res, '更新失败', 500, 500);
  }
});

// PUT /api/auth/password - 修改密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return error(res, '请输入旧密码和新密码');
    }
    if (newPassword.length < 6) {
      return error(res, '新密码长度不能少于 6 个字符');
    }

    const user = await User.findByUsername(req.user.username);
    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return error(res, '旧密码错误');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(req.user.id, hash);
    success(res, null, '密码修改成功');
  } catch (err) {
    error(res, '密码修改失败', 500, 500);
  }
});

module.exports = router;
