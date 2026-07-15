const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAuth } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { id: gameId } = req.query;

    // 检查是否已收藏
    const { data: existing } = await supabaseAdmin
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .single();

    if (existing) {
      // 取消收藏
      await supabaseAdmin
        .from('favorites')
        .delete()
        .eq('id', existing.id);

      res.status(200).json(success({ favorited: false }, '已取消收藏'));
    } else {
      // 添加收藏
      await supabaseAdmin
        .from('favorites')
        .insert({ user_id: user.id, game_id: gameId });

      res.status(200).json(success({ favorited: true }, '已收藏'));
    }
  } catch (err) {
    console.error('收藏操作错误:', err);
    res.status(500).json(error('操作失败', 500));
  }
};
