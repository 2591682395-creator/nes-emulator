const db = require('../config/db');

const SaveState = {
  async findByUserAndGame(userId, gameId, slot) {
    const [rows] = await db.query(
      'SELECT * FROM save_states WHERE user_id = ? AND game_id = ? AND slot = ?',
      [userId, gameId, slot]
    );
    return rows[0] || null;
  },

  async findByUser(userId) {
    const [rows] = await db.query(
      `SELECT s.*, g.title as game_title, g.cover_path
       FROM save_states s
       LEFT JOIN games g ON s.game_id = g.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async createOrUpdate({ user_id, game_id, slot, state_data, screenshot_path }) {
    const existing = await this.findByUserAndGame(user_id, game_id, slot);
    if (existing) {
      await db.query(
        'UPDATE save_states SET state_data = ?, screenshot_path = ?, created_at = NOW() WHERE id = ?',
        [state_data, screenshot_path || existing.screenshot_path, existing.id]
      );
      return existing.id;
    } else {
      const [result] = await db.query(
        'INSERT INTO save_states (user_id, game_id, slot, state_data, screenshot_path) VALUES (?, ?, ?, ?, ?)',
        [user_id, game_id, slot, state_data, screenshot_path || null]
      );
      return result.insertId;
    }
  },

  async delete(id, userId) {
    const where = userId ? 'id = ? AND user_id = ?' : 'id = ?';
    const params = userId ? [id, userId] : [id];
    await db.query(`DELETE FROM save_states WHERE ${where}`, params);
  },

  async count() {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM save_states');
    return rows[0].count;
  },
};

module.exports = SaveState;
