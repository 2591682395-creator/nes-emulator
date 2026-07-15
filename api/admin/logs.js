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

    const { page = 1, pageSize = 20 } = req.query;
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const from = (pageNum - 1) * pageSizeNum;
    const to = from + pageSizeNum - 1;

    const { data: logs, count, error: queryError } = await supabaseAdmin
      .from('admin_logs')
      .select('*, profiles(username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryError) {
      return res.status(500).json(error('获取日志失败', 500));
    }

    const list = (logs || []).map(l => ({
      ...l,
      admin_name: l.profiles?.username,
    }));

    res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
  } catch (err) {
    console.error('日志查询错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
