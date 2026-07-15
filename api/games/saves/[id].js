const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAuth } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { id } = req.query;

    if (req.method === 'POST') {
      // 加载存档
      const { data: save, error: queryError } = await supabaseAdmin
        .from('save_states')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (queryError || !save) {
        return res.status(404).json(error('存档不存在', 404));
      }

      res.status(200).json(success(save));
    } else if (req.method === 'DELETE') {
      // 删除存档
      const { error: deleteError } = await supabaseAdmin
        .from('save_states')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        return res.status(500).json(error('删除存档失败', 500));
      }

      res.status(200).json(success(null, '存档已删除'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('存档操作错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
