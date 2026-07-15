const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAdmin } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;

    if (req.method === 'PUT') {
      // 编辑游戏
      const { title, category_id, description, status } = req.body;

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (category_id !== undefined) updates.category_id = Number(category_id);
      if (description !== undefined) updates.description = description;
      if (status && ['pending', 'approved', 'rejected', 'banned'].includes(status)) {
        updates.status = status;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('games')
          .update(updates)
          .eq('id', id);

        if (updateError) {
          return res.status(500).json(error('编辑游戏失败', 500));
        }
      }

      await logAdmin(user.id, 'update_game', 'game', id, `编辑游戏 #${id}`, req);
      res.status(200).json(success(null, '更新成功'));
    } else if (req.method === 'DELETE') {
      // 删除游戏
      const { data: game } = await supabaseAdmin
        .from('games')
        .select('title, rom_path')
        .eq('id', id)
        .single();

      if (!game) {
        return res.status(404).json(error('游戏不存在', 404));
      }

      // 删除 ROM 文件
      if (game.rom_path) {
        await supabaseAdmin.storage.from('roms').remove([game.rom_path]);
      }

      await supabaseAdmin.from('games').delete().eq('id', id);

      await logAdmin(user.id, 'delete_game', 'game', id, `删除游戏：${game.title}`, req);
      res.status(200).json(success(null, '删除成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('游戏操作错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};

async function logAdmin(adminId, action, targetType, targetId, detail, req) {
  await supabaseAdmin.from('admin_logs').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
    ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
  });
}
