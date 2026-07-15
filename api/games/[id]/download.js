const { supabaseAdmin } = require('../../../lib/supabase');
const { optionalAuth } = require('../../../lib/auth');
const { error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const { id } = req.query;
    const user = await optionalAuth(req);

    const { data: game } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (!game) {
      return res.status(404).json(error('游戏不存在', 404));
    }

    // 未审核的游戏需要管理员才能下载
    if (game.status !== 'approved' && (!user || user.profile.role !== 'admin')) {
      return res.status(404).json(error('游戏不存在', 404));
    }

    // 从 Supabase Storage 获取签名 URL
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('roms')
      .createSignedUrl(game.rom_path, 60); // 60秒有效

    if (urlError || !urlData) {
      return res.status(404).json(error('ROM 文件不存在', 404));
    }

    // 增加游玩次数
    await supabaseAdmin
      .from('games')
      .update({ play_count: (game.play_count || 0) + 1 })
      .eq('id', id);

    // 重定向到签名 URL
    res.redirect(302, urlData.signedUrl);
  } catch (err) {
    console.error('下载游戏错误:', err);
    res.status(500).json(error('下载失败', 500));
  }
};
