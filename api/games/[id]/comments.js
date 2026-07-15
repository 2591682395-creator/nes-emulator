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
    const { content, rating } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json(error('评论内容不能为空'));
    }

    // 插入评论
    const { data: comment, error: insertError } = await supabaseAdmin
      .from('comments')
      .insert({
        user_id: user.id,
        game_id: gameId,
        content: content.trim(),
        rating: rating || null,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json(error('评论失败', 500));
    }

    // 更新游戏平均评分
    if (rating) {
      const { data: avgData } = await supabaseAdmin
        .from('comments')
        .select('rating')
        .eq('game_id', gameId)
        .not('rating', 'is', null);

      if (avgData && avgData.length > 0) {
        const avg = avgData.reduce((sum, c) => sum + c.rating, 0) / avgData.length;
        await supabaseAdmin
          .from('games')
          .update({ rating: Math.round(avg * 10) / 10 })
          .eq('id', gameId);
      }
    }

    res.status(200).json(success({ id: comment.id }, '评论成功'));
  } catch (err) {
    console.error('发表评论错误:', err);
    res.status(500).json(error('评论失败', 500));
  }
};
