const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAdmin } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;

    if (req.method === 'PUT') {
      // 编辑用户
      const { nickname, email, role, status, password } = req.body;

      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (!existing) {
        return res.status(404).json(error('用户不存在', 404));
      }

      const updates = {};
      if (nickname !== undefined) updates.nickname = nickname;
      if (email !== undefined) updates.email = email;
      if (role && ['user', 'admin'].includes(role)) updates.role = role;
      if (status && ['active', 'banned'].includes(status)) updates.status = status;

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('profiles').update(updates).eq('id', id);
      }

      // 重置密码
      if (password && password.length >= 6) {
        await supabaseAdmin.auth.admin.updateUserById(id, { password });
      }

      await logAdmin(user.id, 'update_user', 'user', id, `编辑用户：${existing.username}`, req);
      res.status(200).json(success(null, '更新成功'));
    } else if (req.method === 'DELETE') {
      // 删除用户
      if (id === user.id) {
        return res.status(400).json(error('不能删除自己'));
      }

      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', id)
        .single();

      if (!existing) {
        return res.status(404).json(error('用户不存在', 404));
      }

      // 删除 Auth 用户 (会级联删除 profile)
      await supabaseAdmin.auth.admin.deleteUser(id);

      await logAdmin(user.id, 'delete_user', 'user', id, `删除用户：${existing.username}`, req);
      res.status(200).json(success(null, '删除成功'));
    } else if (req.method === 'PATCH') {
      // 更新状态或角色 (兼容原 PUT /users/:id/status 和 PUT /users/:id/role)
      const { status, role: newRole } = req.body;

      if (status) {
        if (!['active', 'banned'].includes(status)) {
          return res.status(400).json(error('无效的状态值'));
        }
        if (id === user.id) {
          return res.status(400).json(error('不能修改自己的状态'));
        }
        await supabaseAdmin.from('profiles').update({ status }).eq('id', id);
        await logAdmin(user.id, 'update_user_status', 'user', id, `将用户状态改为 ${status}`, req);
      }

      if (newRole) {
        if (!['user', 'admin'].includes(newRole)) {
          return res.status(400).json(error('无效的角色值'));
        }
        if (id === user.id) {
          return res.status(400).json(error('不能修改自己的角色'));
        }
        await supabaseAdmin.from('profiles').update({ role: newRole }).eq('id', id);
        await logAdmin(user.id, 'update_user_role', 'user', id, `将用户角色改为 ${newRole}`, req);
      }

      res.status(200).json(success(null, '操作成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('用户操作错误:', err);
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
