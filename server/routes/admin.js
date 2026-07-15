const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const User = require('../models/user');
const Game = require('../models/game');
const Category = require('../models/category');
const SaveState = require('../models/saveState');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { uploadROM, uploadCover } = require('../middleware/upload');
const { success, error, paginated } = require('../utils/response');

const router = express.Router();

// 所有 admin 路由都需要认证 + 管理员权限
router.use(authMiddleware, adminMiddleware);

// 记录管理操作日志
async function logAdmin(adminId, action, targetType, targetId, detail, ip) {
  await db.query(
    'INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId, action, targetType, targetId, detail, ip]
  );
}

// GET /api/admin/stats - 系统统计
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalGames = await Game.count();
    const approvedGames = await Game.count('approved');
    const pendingGames = await Game.count('pending');
    const totalPlays = await Game.totalPlayCount();
    const totalSaves = await SaveState.count();
    const totalCategories = await Category.count();

    // 今日新增
    const [todayUsers] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()"
    );
    const [todayGames] = await db.query(
      "SELECT COUNT(*) as count FROM games WHERE DATE(created_at) = CURDATE()"
    );

    // 最近 7 天注册趋势
    const [weeklyUsers] = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // 最近 7 天上传趋势
    const [weeklyGames] = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM games
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // 热门游戏
    const popularGames = await Game.findPopular(5);

    // 最新游戏
    const recentGames = await Game.findRecent(5);

    success(res, {
      totalUsers,
      totalGames,
      approvedGames,
      pendingGames,
      totalPlays,
      totalSaves,
      totalCategories,
      todayUsers: todayUsers[0].count,
      todayGames: todayGames[0].count,
      weeklyUsers,
      weeklyGames,
      popularGames,
      recentGames,
    });
  } catch (err) {
    console.error('获取统计错误:', err);
    error(res, '获取统计失败', 500, 500);
  }
});

// ===== 用户管理 =====

// GET /api/admin/users - 用户列表
router.get('/users', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status } = req.query;
    const result = await User.list({ page: Number(page), pageSize: Number(pageSize), keyword, status });
    paginated(res, { ...result, page, pageSize });
  } catch (err) {
    error(res, '获取用户列表失败', 500, 500);
  }
});

// POST /api/admin/users - 新增用户
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, nickname, role } = req.body;
    if (!username || !email || !password) {
      return error(res, '用户名、邮箱和密码不能为空');
    }
    if (username.length < 3 || username.length > 20) {
      return error(res, '用户名长度需为 3-20 个字符');
    }
    if (password.length < 6) {
      return error(res, '密码长度不能少于 6 个字符');
    }

    if (await User.findByUsername(username)) {
      return error(res, '用户名已被注册');
    }
    if (await User.findByEmail(email)) {
      return error(res, '邮箱已被注册');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = await User.create({ username, email, password_hash, nickname });

    if (role && ['user', 'admin'].includes(role)) {
      await User.updateRole(userId, role);
    }

    await logAdmin(req.user.id, 'create_user', 'user', userId,
      `新增用户：${username}`, req.ip);
    success(res, { id: userId }, '新增成功');
  } catch (err) {
    console.error('新增用户错误:', err);
    error(res, '新增用户失败', 500, 500);
  }
});

// PUT /api/admin/users/:id - 编辑用户
router.put('/users/:id', async (req, res) => {
  try {
    const { nickname, email, role, status, password } = req.body;
    const userId = req.params.id;

    // 检查用户是否存在
    const existing = await User.findById(userId);
    if (!existing) {
      return error(res, '用户不存在', 404, 404);
    }

    // 更新昵称和邮箱
    if (nickname !== undefined || email !== undefined) {
      await User.updateProfile(userId, { nickname, email });
    }

    // 更新角色
    if (role && ['user', 'admin'].includes(role)) {
      await User.updateRole(userId, role);
    }

    // 更新状态
    if (status && ['active', 'banned'].includes(status)) {
      await User.updateStatus(userId, status);
    }

    // 重置密码
    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      await User.updatePassword(userId, hash);
    }

    await logAdmin(req.user.id, 'update_user', 'user', userId,
      `编辑用户：${existing.username}`, req.ip);
    success(res, null, '更新成功');
  } catch (err) {
    console.error('编辑用户错误:', err);
    error(res, '编辑用户失败', 500, 500);
  }
});

// DELETE /api/admin/users/:id - 删除用户
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return error(res, '用户不存在', 404, 404);
    }
    if (Number(req.params.id) === req.user.id) {
      return error(res, '不能删除自己');
    }

    await User.delete(req.params.id);
    await logAdmin(req.user.id, 'delete_user', 'user', req.params.id,
      `删除用户：${user.username}`, req.ip);
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除用户错误:', err);
    error(res, '删除用户失败', 500, 500);
  }
});

// PUT /api/admin/users/:id/status - 更新用户状态
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'banned'].includes(status)) {
      return error(res, '无效的状态值');
    }
    if (Number(req.params.id) === req.user.id) {
      return error(res, '不能修改自己的状态');
    }
    await User.updateStatus(req.params.id, status);
    await logAdmin(req.user.id, 'update_user_status', 'user', req.params.id,
      `将用户状态改为 ${status}`, req.ip);
    success(res, null, '操作成功');
  } catch (err) {
    error(res, '操作失败', 500, 500);
  }
});

// PUT /api/admin/users/:id/role - 修改用户角色
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return error(res, '无效的角色值');
    }
    if (Number(req.params.id) === req.user.id) {
      return error(res, '不能修改自己的角色');
    }
    await User.updateRole(req.params.id, role);
    await logAdmin(req.user.id, 'update_user_role', 'user', req.params.id,
      `将用户角色改为 ${role}`, req.ip);
    success(res, null, '操作成功');
  } catch (err) {
    error(res, '操作失败', 500, 500);
  }
});

// ===== 游戏管理 =====

// GET /api/admin/games - 游戏列表
router.get('/games', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status, category_id } = req.query;
    const result = await Game.list({
      page: Number(page),
      pageSize: Number(pageSize),
      keyword,
      status,
      category_id: category_id ? Number(category_id) : undefined,
    });
    paginated(res, { ...result, page, pageSize });
  } catch (err) {
    error(res, '获取游戏列表失败', 500, 500);
  }
});

// POST /api/admin/games - 管理员新增游戏（支持上传 ROM）
router.post('/games', uploadROM.single('rom'), async (req, res) => {
  try {
    const { title, category_id, description, status: gameStatus } = req.body;
    if (!title) {
      return error(res, '游戏名称不能为空');
    }

    let romPath = req.body.rom_path;
    let fileSize = 0;
    let md5 = null;

    // 如果上传了 ROM 文件
    if (req.file) {
      romPath = `/uploads/roms/${req.file.filename}`;
      fileSize = req.file.size;
      const fileBuffer = fs.readFileSync(req.file.path);
      md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

      // 检查重复
      const [existing] = await db.query('SELECT id, title FROM games WHERE file_md5 = ?', [md5]);
      if (existing.length > 0) {
        fs.unlinkSync(req.file.path);
        return error(res, `该游戏已存在：${existing[0].title}`);
      }
    } else if (!romPath) {
      return error(res, '请上传 ROM 文件或提供 ROM 路径');
    }

    const gameId = await Game.create({
      title,
      category_id: category_id ? Number(category_id) : undefined,
      description,
      rom_path: romPath,
      file_size: fileSize,
      file_md5: md5,
      uploader_id: req.user.id,
    });

    // 设置状态
    const status = gameStatus || 'approved';
    if (status !== 'pending') {
      await Game.update(gameId, { status });
    }

    await logAdmin(req.user.id, 'create_game', 'game', gameId,
      `新增游戏：${title}`, req.ip);
    success(res, { id: gameId }, '新增成功');
  } catch (err) {
    console.error('管理员新增游戏错误:', err);
    error(res, '新增游戏失败', 500, 500);
  }
});

// PUT /api/admin/games/:id - 管理员编辑游戏
router.put('/games/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return error(res, '游戏不存在', 404, 404);
    }

    const { title, category_id, description, status } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (category_id !== undefined) updateData.category_id = Number(category_id);
    if (description !== undefined) updateData.description = description;
    if (status && ['pending', 'approved', 'rejected', 'banned'].includes(status)) {
      updateData.status = status;
    }

    if (Object.keys(updateData).length > 0) {
      await Game.update(req.params.id, updateData);
    }

    await logAdmin(req.user.id, 'update_game', 'game', req.params.id,
      `编辑游戏：${game.title}`, req.ip);
    success(res, null, '更新成功');
  } catch (err) {
    console.error('管理员编辑游戏错误:', err);
    error(res, '编辑游戏失败', 500, 500);
  }
});

// PUT /api/admin/games/:id/status - 审核游戏
router.put('/games/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'banned'].includes(status)) {
      return error(res, '无效的状态值');
    }
    await Game.update(req.params.id, { status });
    await logAdmin(req.user.id, 'review_game', 'game', req.params.id,
      `将游戏审核状态改为 ${status}`, req.ip);
    success(res, null, '操作成功');
  } catch (err) {
    error(res, '操作失败', 500, 500);
  }
});

// DELETE /api/admin/games/:id - 删除游戏
router.delete('/games/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return error(res, '游戏不存在', 404, 404);
    }

    // 删除 ROM 文件
    const romFullPath = path.join(__dirname, '../..', game.rom_path);
    if (fs.existsSync(romFullPath)) {
      fs.unlinkSync(romFullPath);
    }

    await Game.delete(req.params.id);
    await logAdmin(req.user.id, 'delete_game', 'game', req.params.id,
      `删除游戏：${game.title}`, req.ip);
    success(res, null, '删除成功');
  } catch (err) {
    error(res, '删除失败', 500, 500);
  }
});

// ===== 分类管理 =====

// POST /api/admin/categories - 新增分类
router.post('/categories', async (req, res) => {
  try {
    const { name, slug, icon, sort_order } = req.body;
    if (!name || !slug) {
      return error(res, '分类名称和标识不能为空');
    }

    const existing = await Category.findById(slug);
    // Check slug uniqueness
    const [existingSlug] = await db.query('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existingSlug.length > 0) {
      return error(res, '分类标识已存在');
    }

    const id = await Category.create({ name, slug, icon, sort_order });
    await logAdmin(req.user.id, 'create_category', 'category', id,
      `新增分类：${name}`, req.ip);
    success(res, { id }, '新增成功');
  } catch (err) {
    error(res, '新增分类失败', 500, 500);
  }
});

// PUT /api/admin/categories/:id - 编辑分类
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, slug, icon, sort_order } = req.body;
    await Category.update(req.params.id, { name, slug, icon, sort_order });
    await logAdmin(req.user.id, 'update_category', 'category', req.params.id,
      `编辑分类：${name || ''}`, req.ip);
    success(res, null, '更新成功');
  } catch (err) {
    error(res, '更新分类失败', 500, 500);
  }
});

// DELETE /api/admin/categories/:id - 删除分类
router.delete('/categories/:id', async (req, res) => {
  try {
    await Category.delete(req.params.id);
    await logAdmin(req.user.id, 'delete_category', 'category', req.params.id,
      '删除分类', req.ip);
    success(res, null, '删除成功');
  } catch (err) {
    error(res, '删除分类失败', 500, 500);
  }
});

// ===== 评论管理 =====

// GET /api/admin/comments - 评论列表
router.get('/comments', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, game_id } = req.query;
    let where = '1=1';
    const params = [];
    if (game_id) {
      where += ' AND c.game_id = ?';
      params.push(game_id);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM comments c WHERE ${where}`, params
    );
    const total = countRows[0].total;

    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT c.*, u.nickname, u.username, g.title as game_title
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN games g ON c.game_id = g.id
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset]
    );

    paginated(res, { list: rows, total, page, pageSize });
  } catch (err) {
    error(res, '获取评论列表失败', 500, 500);
  }
});

// PUT /api/admin/comments/:id/status - 隐藏/显示评论
router.put('/comments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['visible', 'hidden'].includes(status)) {
      return error(res, '无效的状态值');
    }
    await db.query('UPDATE comments SET status = ? WHERE id = ?', [status, req.params.id]);
    success(res, null, '操作成功');
  } catch (err) {
    error(res, '操作失败', 500, 500);
  }
});

// DELETE /api/admin/comments/:id - 删除评论
router.delete('/comments/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
    success(res, null, '删除成功');
  } catch (err) {
    error(res, '删除失败', 500, 500);
  }
});

// ===== 系统设置 =====

// GET /api/admin/settings - 获取系统设置
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM system_settings ORDER BY id');
    success(res, rows);
  } catch (err) {
    error(res, '获取设置失败', 500, 500);
  }
});

// PUT /api/admin/settings - 更新系统设置
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return error(res, '参数格式错误');
    }

    for (const item of settings) {
      await db.query(
        'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
        [item.setting_value, item.setting_key]
      );
    }

    await logAdmin(req.user.id, 'update_settings', 'system', null,
      `更新了 ${settings.length} 项设置`, req.ip);
    success(res, null, '设置已保存');
  } catch (err) {
    error(res, '保存设置失败', 500, 500);
  }
});

// ===== 操作日志 =====

// GET /api/admin/logs - 操作日志
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;

    const [countRows] = await db.query('SELECT COUNT(*) as total FROM admin_logs');
    const total = countRows[0].total;

    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT l.*, u.username as admin_name
       FROM admin_logs l
       LEFT JOIN users u ON l.admin_id = u.id
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(pageSize), offset]
    );

    paginated(res, { list: rows, total, page, pageSize });
  } catch (err) {
    error(res, '获取日志失败', 500, 500);
  }
});

module.exports = router;
