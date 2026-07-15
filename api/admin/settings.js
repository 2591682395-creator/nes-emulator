const { supabaseAdmin } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      const { data: settings, error: queryError } = await supabaseAdmin
        .from('system_settings')
        .select('*')
        .order('id');

      if (queryError) {
        return res.status(500).json(error('获取设置失败', 500));
      }

      res.status(200).json(success(settings));
    } else if (req.method === 'PUT') {
      const { settings } = req.body;
      if (!Array.isArray(settings)) {
        return res.status(400).json(error('参数格式错误'));
      }

      for (const item of settings) {
        await supabaseAdmin
          .from('system_settings')
          .update({ setting_value: item.setting_value })
          .eq('setting_key', item.setting_key);
      }

      await logAdmin(user.id, 'update_settings', 'system', null, `更新了 ${settings.length} 项设置`, req);
      res.status(200).json(success(null, '设置已保存'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('设置管理错误:', err);
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
