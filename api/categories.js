const { supabaseAdmin } = require('../lib/supabase');
const { success, error } = require('../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const { data: categories, error: queryError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (queryError) {
      return res.status(500).json(error('获取分类失败', 500));
    }

    // 获取每个分类的游戏数量
    const categoriesWithCount = await Promise.all(
      (categories || []).map(async (cat) => {
        const { count } = await supabaseAdmin
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id)
          .eq('status', 'approved');

        return { ...cat, game_count: count || 0 };
      })
    );

    res.status(200).json(success(categoriesWithCount));
  } catch (err) {
    console.error('获取分类错误:', err);
    res.status(500).json(error('获取分类失败', 500));
  }
};
