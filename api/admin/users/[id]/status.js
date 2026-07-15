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
    const { status } = req.body;

    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json(error('无效的状态值'));
    }

    if (id === user.id) {
      return res.status(400).json(error('不能修改自己的状态'));
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json(error('操作失败', 500));
    }

    await logAdmin(user.id, 'update_user_status', 'user', id, `将用户状态改为 ${status}`, req);
    res.status(200).json(success(null, '操作成功'));
  } catch (err) {
    console.error('用户状态更新错误:', err);
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
