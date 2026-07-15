const { supabaseAdmin } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/auth');
const { success, error, paginated } = require('../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { page = 1, pageSize = 20, game_id } = req.query;
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const from = (pageNum - 1) * pageSizeNum;
    const to = from + pageSizeNum - 1;

    let query = supabaseAdmin
      .from('comments')
      .select('*, profiles(username, nickname), games(title)', { count: 'exact' });

    if (game_id) {
      query = query.eq('game_id', game_id);
    }

    const { data: comments, count, error: queryError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryError) {
      return res.status(500).json(error('获取评论列表失败', 500));
    }

    const list = (comments || []).map(c => ({
      ...c,
      nickname: c.profiles?.nickname || c.profiles?.username,
      game_title: c.games?.title,
    }));

    res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
  } catch (err) {
    console.error('评论管理错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
