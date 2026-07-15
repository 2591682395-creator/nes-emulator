const { supabaseAdmin } = require('../../../../lib/supabase');
const { requireAdmin } = require('../../../../lib/auth');
const { success, error } = require('../../../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;
    const { status } = req.body;

    if (!['visible', 'hidden'].includes(status)) {
      return res.status(400).json(error('无效的状态值'));
    }

    const { error: updateError } = await supabaseAdmin
      .from('comments')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json(error('操作失败', 500));
    }

    res.status(200).json(success(null, '操作成功'));
  } catch (err) {
    console.error('评论状态更新错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
