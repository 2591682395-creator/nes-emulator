const { supabaseAdmin } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    if (req.method === 'POST') {
      const { name, slug, icon, sort_order } = req.body;
      if (!name || !slug) {
        return res.status(400).json(error('分类名称和标识不能为空'));
      }

      // 检查 slug 唯一性
      const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('slug', slug)
        .single();

      if (existing) {
        return res.status(400).json(error('分类标识已存在'));
      }

      const { data: category, error: createError } = await supabaseAdmin
        .from('categories')
        .insert({ name, slug, icon: icon || '🎮', sort_order: sort_order || 0 })
        .select()
        .single();

      if (createError) {
        return res.status(500).json(error('新增分类失败', 500));
      }

      await logAdmin(user.id, 'create_category', 'category', category.id, `新增分类：${name}`, req);
      res.status(200).json(success({ id: category.id }, '新增成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('分类管理错误:', err);
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
