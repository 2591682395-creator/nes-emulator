const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Game = require('../models/game');
const Category = require('../models/category');
const SaveState = require('../models/saveState');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { uploadROM } = require('../middleware/upload');
const { success, error, paginated } = require('../utils/response');
const db = require('../config/db');

const router = express.Router();

// GET /api/games - 游戏列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, category_id, status } = req.query;

    // 普通用户只能看到已审核的游戏
    const isAdmin = req.user && req.user.role === 'admin';
    const queryStatus = isAdmin ? status : 'approved';

    const result = await Game.list({
      page: Number(page),
      pageSize: Number(pageSize),
      keyword,
      category_id: category_id ? Number(category_id) : undefined,
      status: queryStatus,
    });

    paginated(res, { ...result, page, pageSize });
  } catch (err) {
    console.error('游戏列表错误:', err);
    error(res, '获取游戏列表失败', 500, 500);
  }
});

// GET /api/games/:id - 游戏详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return error(res, '游戏不存在', 404, 404);
    }

    // 普通用户只能看已审核的
    if (game.status !== 'approved' && (!req.user || req.user.role !== 'admin')) {
      return error(res, '游戏不存在', 404, 404);
    }

    // 检查是否已收藏
    let isFavorited = false;
    if (req.user) {
      const [fav] = await db.query(
        'SELECT id FROM favorites WHERE user_id = ? AND game_id = ?',
        [req.user.id, req.params.id]
      );
      isFavorited = fav.length > 0;
    }

    // 获取评论
    const [comments] = await db.query(
      `SELECT c.*, u.nickname, u.avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.game_id = ? AND c.status = 'visible'
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );

    success(res, { ...game, isFavorited, comments });
  } catch (err) {
    console.error('游戏详情错误:', err);
    error(res, '获取游戏详情失败', 500, 500);
  }
});

// POST /api/games - 上传游戏
router.post('/', authMiddleware, uploadROM.single('rom'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请选择 ROM 文件');
    }

    // 检查是否允许上传
    const [settings] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'allow_upload'");
    if (settings.length > 0 && settings[0].setting_value === 'false') {
      if (req.user.role !== 'admin') {
        return error(res, '暂不允许上传', 403, 403);
      }
    }

    const { title, category_id, description } = req.body;
    if (!title) {
      return error(res, '游戏名称不能为空');
    }

    // 计算 MD5
    const fileBuffer = fs.readFileSync(req.file.path);
    const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

    // 检查是否已上传
    const [existing] = await db.query('SELECT id, title FROM games WHERE file_md5 = ?', [md5]);
    if (existing.length > 0) {
      // 删除重复文件
      fs.unlinkSync(req.file.path);
      return error(res, `该游戏已存在：${existing[0].title}`);
    }

    // 获取默认审核状态
    const [statusSetting] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'default_game_status'");
    const gameStatus = req.user.role === 'admin'
      ? (statusSetting.length > 0 ? statusSetting[0].setting_value : 'approved')
      : 'pending';

    const gameId = await Game.create({
      title,
      category_id: category_id ? Number(category_id) : undefined,
      description,
      rom_path: `/uploads/roms/${req.file.filename}`,
      file_size: req.file.size,
      file_md5: md5,
      uploader_id: req.user.id,
    });

    // 管理员自动通过
    if (gameStatus === 'approved') {
      await Game.update(gameId, { status: 'approved' });
    }

    success(res, { id: gameId }, '上传成功，等待审核');
  } catch (err) {
    console.error('上传游戏错误:', err);
    error(res, '上传失败', 500, 500);
  }
});

// DELETE /api/games/:id - 删除游戏
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return error(res, '游戏不存在', 404, 404);
    }

    // 只有作者或管理员可以删除
    if (game.uploader_id !== req.user.id && req.user.role !== 'admin') {
      return error(res, '没有权限删除', 403, 403);
    }

    // 删除 ROM 文件
    const romFullPath = path.join(__dirname, '../..', game.rom_path);
    if (fs.existsSync(romFullPath)) {
      fs.unlinkSync(romFullPath);
    }

    await Game.delete(req.params.id);
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除游戏错误:', err);
    error(res, '删除失败', 500, 500);
  }
});

// POST /api/games/:id/favorite - 收藏/取消收藏
router.post('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;

    const [existing] = await db.query(
      'SELECT id FROM favorites WHERE user_id = ? AND game_id = ?',
      [userId, gameId]
    );

    if (existing.length > 0) {
      await db.query('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
      success(res, { favorited: false }, '已取消收藏');
    } else {
      await db.query('INSERT INTO favorites (user_id, game_id) VALUES (?, ?)', [userId, gameId]);
      success(res, { favorited: true }, '已收藏');
    }
  } catch (err) {
    console.error('收藏操作错误:', err);
    error(res, '操作失败', 500, 500);
  }
});

// POST /api/games/:id/comments - 发表评论
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content, rating } = req.body;
    if (!content || content.trim().length === 0) {
      return error(res, '评论内容不能为空');
    }

    const [result] = await db.query(
      'INSERT INTO comments (user_id, game_id, content, rating) VALUES (?, ?, ?, ?)',
      [req.user.id, req.params.id, content.trim(), rating || null]
    );

    // 更新游戏平均评分
    if (rating) {
      await db.query(
        `UPDATE games SET rating = (SELECT IFNULL(AVG(rating), 0) FROM comments WHERE game_id = ? AND rating IS NOT NULL) WHERE id = ?`,
        [req.params.id, req.params.id]
      );
    }

    success(res, { id: result.insertId }, '评论成功');
  } catch (err) {
    console.error('发表评论错误:', err);
    error(res, '评论失败', 500, 500);
  }
});

// GET /api/games/:id/download - 下载 ROM（已审核游戏无需登录）
router.get('/:id/download', optionalAuth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return error(res, '游戏不存在', 404, 404);
    }

    // 未审核的游戏需要管理员才能下载
    if (game.status !== 'approved' && (!req.user || req.user.role !== 'admin')) {
      return error(res, '游戏不存在', 404, 404);
    }

    const romFullPath = path.join(__dirname, '../..', game.rom_path);
    if (!fs.existsSync(romFullPath)) {
      return error(res, 'ROM 文件不存在', 404, 404);
    }

    // 增加游玩次数
    await Game.incrementPlayCount(req.params.id);

    res.download(romFullPath, `${game.title}.nes`);
  } catch (err) {
    console.error('下载游戏错误:', err);
    error(res, '下载失败', 500, 500);
  }
});

// ===== 存档接口 =====

// GET /api/saves - 获取我的存档列表
router.get('/saves/list', authMiddleware, async (req, res) => {
  try {
    const saves = await SaveState.findByUser(req.user.id);
    success(res, saves);
  } catch (err) {
    error(res, '获取存档列表失败', 500, 500);
  }
});

// POST /api/saves - 保存游戏进度
router.post('/saves', authMiddleware, async (req, res) => {
  try {
    const { game_id, slot = 1, state_data, screenshot_path } = req.body;
    if (!game_id || !state_data) {
      return error(res, '缺少游戏 ID 或存档数据');
    }

    const id = await SaveState.createOrUpdate({
      user_id: req.user.id,
      game_id,
      slot,
      state_data,
      screenshot_path,
    });

    success(res, { id }, '存档成功');
  } catch (err) {
    console.error('保存进度错误:', err);
    error(res, '存档失败', 500, 500);
  }
});

// POST /api/saves/:id/load - 加载存档
router.post('/saves/:id/load', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM save_states WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return error(res, '存档不存在', 404, 404);
    }
    success(res, rows[0]);
  } catch (err) {
    error(res, '加载存档失败', 500, 500);
  }
});

// DELETE /api/saves/:id - 删除存档
router.delete('/saves/:id', authMiddleware, async (req, res) => {
  try {
    await SaveState.delete(req.params.id, req.user.id);
    success(res, null, '存档已删除');
  } catch (err) {
    error(res, '删除存档失败', 500, 500);
  }
});

module.exports = router;
