const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAdmin } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;

    if (req.method === 'PUT') {
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
    } else if (req.method === 'DELETE') {
      const { error: deleteError } = await supabaseAdmin
        .from('comments')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return res.status(500).json(error('删除失败', 500));
      }

      res.status(200).json(success(null, '删除成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('评论操作错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
