const { supabaseAdmin } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    // 获取各项统计
    const [
      { count: totalUsers },
      { count: totalGames },
      { count: approvedGames },
      { count: pendingGames },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('games').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    // 总游玩次数
    const { data: playData } = await supabaseAdmin
      .from('games')
      .select('play_count');
    const totalPlays = (playData || []).reduce((sum, g) => sum + (g.play_count || 0), 0);

    // 存档数
    const { count: totalSaves } = await supabaseAdmin
      .from('save_states')
      .select('*', { count: 'exact', head: true });

    // 分类数
    const { count: totalCategories } = await supabaseAdmin
      .from('categories')
      .select('*', { count: 'exact', head: true });

    // 今日新增
    const today = new Date().toISOString().split('T')[0];
    const { count: todayUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    const { count: todayGames } = await supabaseAdmin
      .from('games')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    // 最近 7 天注册趋势
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weeklyUsersData } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .gte('created_at', sevenDaysAgo);

    const { data: weeklyGamesData } = await supabaseAdmin
      .from('games')
      .select('created_at')
      .gte('created_at', sevenDaysAgo);

    // 按日期分组
    const weeklyUsers = groupByDate(weeklyUsersData || []);
    const weeklyGames = groupByDate(weeklyGamesData || []);

    // 热门游戏
    const { data: popularGames } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('status', 'approved')
      .order('play_count', { ascending: false })
      .limit(5);

    // 最新游戏
    const { data: recentGames } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(5);

    res.status(200).json(success({
      totalUsers: totalUsers || 0,
      totalGames: totalGames || 0,
      approvedGames: approvedGames || 0,
      pendingGames: pendingGames || 0,
      totalPlays,
      totalSaves: totalSaves || 0,
      totalCategories: totalCategories || 0,
      todayUsers: todayUsers || 0,
      todayGames: todayGames || 0,
      weeklyUsers,
      weeklyGames,
      popularGames: popularGames || [],
      recentGames: recentGames || [],
    }));
  } catch (err) {
    console.error('获取统计错误:', err);
    res.status(500).json(error('获取统计失败', 500));
  }
};

function groupByDate(items) {
  const groups = {};
  items.forEach(item => {
    const date = item.created_at.split('T')[0];
    groups[date] = (groups[date] || 0) + 1;
  });
  return Object.entries(groups).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}
