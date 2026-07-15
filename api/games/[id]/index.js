const { supabase, supabaseAdmin } = require('../../lib/supabase');
const { requireAuth, optionalAuth } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // 获取游戏详情
      const user = await optionalAuth(req);

      const { data: game, error: queryError } = await supabaseAdmin
        .from('games')
        .select('*, categories(name)')
        .eq('id', id)
        .single();

      if (queryError || !game) {
        return res.status(404).json(error('游戏不存在', 404));
      }

      // 普通用户只能看已审核的
      if (game.status !== 'approved' && (!user || user.profile.role !== 'admin')) {
        return res.status(404).json(error('游戏不存在', 404));
      }

      // 检查是否已收藏
      let isFavorited = false;
      if (user) {
        const { data: fav } = await supabaseAdmin
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('game_id', id)
          .single();
        isFavorited = !!fav;
      }

      // 获取评论
      const { data: comments } = await supabaseAdmin
        .from('comments')
        .select('*, profiles(username, nickname, avatar)')
        .eq('game_id', id)
        .eq('status', 'visible')
        .order('created_at', { ascending: false })
        .limit(50);

      const formattedComments = (comments || []).map(c => ({
        ...c,
        nickname: c.profiles?.nickname || c.profiles?.username,
        avatar: c.profiles?.avatar,
      }));

      res.status(200).json(success({
        ...game,
        category_name: game.categories?.name || null,
        isFavorited,
        comments: formattedComments,
      }));
    } else if (req.method === 'DELETE') {
      // 删除游戏
      const user = await requireAuth(req, res);
      if (!user) return;

      const { data: game } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', id)
        .single();

      if (!game) {
        return res.status(404).json(error('游戏不存在', 404));
      }

      // 只有作者或管理员可以删除
      if (game.uploader_id !== user.id && user.profile.role !== 'admin') {
        return res.status(403).json(error('没有权限删除', 403));
      }

      // 删除 ROM 文件
      if (game.rom_path) {
        await supabaseAdmin.storage.from('roms').remove([game.rom_path]);
      }

      // 删除游戏记录
      const { error: deleteError } = await supabaseAdmin
        .from('games')
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
    console.error('游戏详情/删除错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
