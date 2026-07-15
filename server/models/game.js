const db = require('../config/db');

const Game = {
  async findById(id) {
    const [rows] = await db.query(
      `SELECT g.*, c.name as category_name, c.icon as category_icon,
              u.nickname as uploader_name
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       LEFT JOIN users u ON g.uploader_id = u.id
       WHERE g.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ title, category_id, description, rom_path, cover_path, file_size, file_md5, uploader_id }) {
    const [result] = await db.query(
      `INSERT INTO games (title, category_id, description, rom_path, cover_path, file_size, file_md5, uploader_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, category_id || null, description || '', rom_path, cover_path || null, file_size || 0, file_md5 || null, uploader_id]
    );
    return result.insertId;
  },

  async update(id, fields) {
    const allowed = ['title', 'category_id', 'description', 'cover_path', 'status'];
    const setClauses = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (setClauses.length === 0) return false;
    values.push(id);
    await db.query(`UPDATE games SET ${setClauses.join(', ')} WHERE id = ?`, values);
    return true;
  },

  async delete(id) {
    await db.query('DELETE FROM games WHERE id = ?', [id]);
  },

  async incrementPlayCount(id) {
    await db.query('UPDATE games SET play_count = play_count + 1 WHERE id = ?', [id]);
  },

  async list({ page = 1, pageSize = 20, keyword, category_id, status, uploader_id }) {
    let where = '1=1';
    const params = [];

    if (keyword) {
      where += ' AND g.title LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (category_id) {
      where += ' AND g.category_id = ?';
      params.push(category_id);
    }
    if (status) {
      where += ' AND g.status = ?';
      params.push(status);
    }
    if (uploader_id) {
      where += ' AND g.uploader_id = ?';
      params.push(uploader_id);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM games g WHERE ${where}`, params
    );
    const total = countRows[0].total;

    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT g.id, g.title, g.category_id, g.description, g.cover_path,
              g.file_size, g.region, g.play_count, g.rating, g.status,
              g.created_at, g.updated_at,
              c.name as category_name, c.icon as category_icon,
              u.nickname as uploader_name
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       LEFT JOIN users u ON g.uploader_id = u.id
       WHERE ${where}
       ORDER BY g.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { list: rows, total };
  },

  async count(status) {
    let sql = 'SELECT COUNT(*) as count FROM games';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    const [rows] = await db.query(sql, params);
    return rows[0].count;
  },

  async totalPlayCount() {
    const [rows] = await db.query('SELECT IFNULL(SUM(play_count), 0) as total FROM games');
    return rows[0].total;
  },

  async findRecent(limit = 5) {
    const [rows] = await db.query(
      `SELECT g.id, g.title, g.cover_path, g.play_count, c.name as category_name, c.icon as category_icon
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       WHERE g.status = 'approved'
       ORDER BY g.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },

  async findPopular(limit = 5) {
    const [rows] = await db.query(
      `SELECT g.id, g.title, g.cover_path, g.play_count, c.name as category_name, c.icon as category_icon
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       WHERE g.status = 'approved'
       ORDER BY g.play_count DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },
};

module.exports = Game;
