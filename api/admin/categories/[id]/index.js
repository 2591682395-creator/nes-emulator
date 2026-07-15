const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAdmin } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;

    if (req.method === 'PUT') {
      const { name, slug, icon, sort_order } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (slug !== undefined) updates.slug = slug;
      if (icon !== undefined) updates.icon = icon;
      if (sort_order !== undefined) updates.sort_order = sort_order;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('categories')
          .update(updates)
          .eq('id', id);

        if (updateError) {
          return res.status(500).json(error('更新分类失败', 500));
        }
      }

      await logAdmin(user.id, 'update_category', 'category', id, `编辑分类：${name || ''}`, req);
      res.status(200).json(success(null, '更新成功'));
    } else if (req.method === 'DELETE') {
      await supabaseAdmin.from('categories').delete().eq('id', id);

      await logAdmin(user.id, 'delete_category', 'category', id, '删除分类', req);
      res.status(200).json(success(null, '删除成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('分类操作错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};

async function logAdmin(adminId, action, targetType, targetId, detail, req) {
  await supabaseAdmin.from('admin_logs').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
    ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
  });
}
