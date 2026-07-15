const { supabaseAdmin } = require('../../../lib/supabase');
const { requireAuth } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      // 获取存档列表
      const { data: saves, error: queryError } = await supabaseAdmin
        .from('save_states')
        .select('*, games(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        return res.status(500).json(error('获取存档列表失败', 500));
      }

      const list = (saves || []).map(s => ({
        ...s,
        game_title: s.games?.title || null,
      }));

      res.status(200).json(success(list));
    } else if (req.method === 'POST') {
      // 保存游戏进度
      const { game_id, slot = 1, state_data, screenshot_path } = req.body;

      if (!game_id || !state_data) {
        return res.status(400).json(error('缺少游戏 ID 或存档数据'));
      }

      // Upsert: 先查找是否已存在
      const { data: existing } = await supabaseAdmin
        .from('save_states')
        .select('id')
        .eq('user_id', user.id)
        .eq('game_id', game_id)
        .eq('slot', slot)
        .single();

      if (existing) {
        // 更新
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('save_states')
          .update({ state_data, screenshot_path })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          return res.status(500).json(error('存档失败', 500));
        }

        res.status(200).json(success({ id: updated.id }, '存档成功'));
      } else {
        // 新建
        const { data: created, error: createError } = await supabaseAdmin
          .from('save_states')
          .insert({
            user_id: user.id,
            game_id,
            slot,
            state_data,
            screenshot_path,
          })
          .select()
          .single();

        if (createError) {
          return res.status(500).json(error('存档失败', 500));
        }

        res.status(200).json(success({ id: created.id }, '存档成功'));
      }
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('存档 API 错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};
