const { supabaseAdmin } = require('../../../../lib/supabase');
const { requireAdmin } = require('../../../../lib/auth');
const { success, error } = require('../../../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json(error('无效的角色值'));
    }

    if (id === user.id) {
      return res.status(400).json(error('不能修改自己的角色'));
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json(error('操作失败', 500));
    }

    await logAdmin(user.id, 'update_user_role', 'user', id, `将用户角色改为 ${role}`, req);
    res.status(200).json(success(null, '操作成功'));
  } catch (err) {
    console.error('用户角色更新错误:', err);
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
