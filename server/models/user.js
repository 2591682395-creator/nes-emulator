const db = require('../config/db');

const User = {
  async findById(id) {
    const [rows] = await db.query(
      'SELECT id, username, email, nickname, avatar, role, status, last_login_at, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async findByUsername(username) {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async create({ username, email, password_hash, nickname }) {
    const [result] = await db.query(
      'INSERT INTO users (username, email, password_hash, nickname) VALUES (?, ?, ?, ?)',
      [username, email, password_hash, nickname || username]
    );
    return result.insertId;
  },

  async updateProfile(id, { nickname, avatar }) {
    const fields = [];
    const values = [];
    if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (fields.length === 0) return false;
    values.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  },

  async updatePassword(id, password_hash) {
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);
  },

  async updateLastLogin(id) {
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
  },

  async list({ page = 1, pageSize = 20, keyword, status }) {
    let where = '1=1';
    const params = [];

    if (keyword) {
      where += ' AND (username LIKE ? OR nickname LIKE ? OR email LIKE ?)';
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM users WHERE ${where}`, params);
    const total = countRows[0].total;

    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT id, username, email, nickname, avatar, role, status, last_login_at, created_at
       FROM users WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { list: rows, total };
  },

  async updateStatus(id, status) {
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  },

  async updateRole(id, role) {
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  },

  async delete(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
  },

  async count() {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
    return rows[0].count;
  },
};

module.exports = User;
