const db = require('../config/db');

const Category = {
  async findAll() {
    const [rows] = await db.query(
      'SELECT c.*, (SELECT COUNT(*) FROM games WHERE category_id = c.id AND status = "approved") as game_count FROM categories c ORDER BY sort_order, id'
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ name, slug, icon, sort_order }) {
    const [result] = await db.query(
      'INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)',
      [name, slug, icon || '🎮', sort_order || 0]
    );
    return result.insertId;
  },

  async update(id, { name, slug, icon, sort_order }) {
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (slug !== undefined) { fields.push('slug = ?'); values.push(slug); }
    if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
    if (fields.length === 0) return false;
    values.push(id);
    await db.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  },

  async delete(id) {
    await db.query('DELETE FROM categories WHERE id = ?', [id]);
  },

  async count() {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM categories');
    return rows[0].count;
  },
};

module.exports = Category;
