const { supabaseAdmin } = require('../../lib/supabase');
const { requireAuth } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 获取当前用户信息
      const user = await requireAuth(req, res);
      if (!user) return;

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      res.status(200).json(success(profile));
    } else if (req.method === 'PUT') {
      // 更新个人信息
      const user = await requireAuth(req, res);
      if (!user) return;

      const { nickname, avatar } = req.body;
      const updates = {};
      if (nickname !== undefined) updates.nickname = nickname;
      if (avatar !== undefined) updates.avatar = avatar;

      const { data: profile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        return res.status(400).json(error('更新失败'));
      }

      res.status(200).json(success(profile, '更新成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('Profile 错误:', err);
    res.status(500).json(error('操作失败', 500));
  }
};
