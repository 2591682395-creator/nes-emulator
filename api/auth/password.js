const { supabaseAdmin } = require('../../lib/supabase');
const { requireAuth } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json(error('请输入旧密码和新密码'));
    }
    if (newPassword.length < 6) {
      return res.status(400).json(error('新密码长度不能少于 6 个字符'));
    }

    // 验证旧密码
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      return res.status(400).json(error('旧密码错误'));
    }

    // 更新密码
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json(error('密码修改失败'));
    }

    res.status(200).json(success(null, '密码修改成功'));
  } catch (err) {
    console.error('密码修改错误:', err);
    res.status(500).json(error('密码修改失败', 500));
  }
};
