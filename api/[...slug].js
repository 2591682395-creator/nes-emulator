const { supabase, supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requireAdmin, optionalAuth } = require('../lib/auth');
const { success, error, paginated } = require('../lib/response');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug } = req.query;
  const path = slug.join('/');
  const method = req.method;

  try {
    // ============================================
    // 认证相关路由
    // ============================================
    if (path === 'auth/register' && method === 'POST') {
      return await handleRegister(req, res);
    }
    if (path === 'auth/login' && method === 'POST') {
      return await handleLogin(req, res);
    }
    if (path === 'auth/profile' && method === 'GET') {
      return await handleGetProfile(req, res);
    }
    if (path === 'auth/profile' && method === 'PUT') {
      return await handleUpdateProfile(req, res);
    }
    if (path === 'auth/password' && method === 'PUT') {
      return await handleChangePassword(req, res);
    }

    // ============================================
    // 游戏列表路由
    // ============================================
    if (path === 'games' && method === 'GET') {
      return await handleGetGames(req, res);
    }
    if (path === 'games' && method === 'POST') {
      return await handleUploadGame(req, res);
    }

    // ============================================
    // 游戏详情/删除
    // ============================================
    if (path.match(/^games\/\d+$/) && method === 'GET') {
      return await handleGetGameDetail(req, res, path);
    }
    if (path.match(/^games\/\d+$/) && method === 'DELETE') {
      return await handleDeleteGame(req, res, path);
    }

    // ============================================
    // 游戏操作
    // ============================================
    if (path.match(/^games\/\d+\/favorite$/) && method === 'POST') {
      return await handleToggleFavorite(req, res, path);
    }
    if (path.match(/^games\/\d+\/comments$/) && method === 'POST') {
      return await handlePostComment(req, res, path);
    }
    if (path.match(/^games\/\d+\/download$/) && method === 'GET') {
      return await handleDownloadGame(req, res, path);
    }

    // ============================================
    // 存档路由
    // ============================================
    if (path === 'games/saves/list' && method === 'GET') {
      return await handleGetSaves(req, res);
    }
    if (path === 'games/saves' && method === 'POST') {
      return await handleCreateSave(req, res);
    }
    if (path.match(/^games\/saves\/\d+\/load$/) && method === 'POST') {
      return await handleLoadSave(req, res, path);
    }
    if (path.match(/^games\/saves\/\d+$/) && method === 'DELETE') {
      return await handleDeleteSave(req, res, path);
    }

    // ============================================
    // 分类路由
    // ============================================
    if (path === 'categories' && method === 'GET') {
      return await handleGetCategories(req, res);
    }

    // ============================================
    // 管理后台路由
    // ============================================
    if (path === 'admin/stats' && method === 'GET') {
      return await handleAdminStats(req, res);
    }
    if (path === 'admin/users' && method === 'GET') {
      return await handleAdminGetUsers(req, res);
    }
    if (path === 'admin/users' && method === 'POST') {
      return await handleAdminCreateUser(req, res);
    }
    if (path.match(/^admin\/users\/[^/]+$/) && method === 'PUT') {
      return await handleAdminUpdateUser(req, res, path);
    }
    if (path.match(/^admin\/users\/[^/]+$/) && method === 'DELETE') {
      return await handleAdminDeleteUser(req, res, path);
    }
    if (path.match(/^admin\/users\/[^/]+\/status$/) && method === 'PUT') {
      return await handleAdminUpdateUserStatus(req, res, path);
    }
    if (path.match(/^admin\/users\/[^/]+\/role$/) && method === 'PUT') {
      return await handleAdminUpdateUserRole(req, res, path);
    }
    if (path === 'admin/games' && method === 'GET') {
      return await handleAdminGetGames(req, res);
    }
    if (path === 'admin/games' && method === 'POST') {
      return await handleAdminCreateGame(req, res);
    }
    if (path.match(/^admin\/games\/\d+$/) && method === 'PUT') {
      return await handleAdminUpdateGame(req, res, path);
    }
    if (path.match(/^admin\/games\/\d+$/) && method === 'DELETE') {
      return await handleAdminDeleteGame(req, res, path);
    }
    if (path.match(/^admin\/games\/\d+\/status$/) && method === 'PUT') {
      return await handleAdminUpdateGameStatus(req, res, path);
    }
    if (path === 'admin/categories' && method === 'POST') {
      return await handleAdminCreateCategory(req, res);
    }
    if (path.match(/^admin\/categories\/\d+$/) && method === 'PUT') {
      return await handleAdminUpdateCategory(req, res, path);
    }
    if (path.match(/^admin\/categories\/\d+$/) && method === 'DELETE') {
      return await handleAdminDeleteCategory(req, res, path);
    }
    if (path === 'admin/comments' && method === 'GET') {
      return await handleAdminGetComments(req, res);
    }
    if (path.match(/^admin\/comments\/\d+\/status$/) && method === 'PUT') {
      return await handleAdminUpdateCommentStatus(req, res, path);
    }
    if (path.match(/^admin\/comments\/\d+$/) && method === 'DELETE') {
      return await handleAdminDeleteComment(req, res, path);
    }
    if (path === 'admin/settings' && method === 'GET') {
      return await handleAdminGetSettings(req, res);
    }
    if (path === 'admin/settings' && method === 'PUT') {
      return await handleAdminUpdateSettings(req, res);
    }
    if (path === 'admin/logs' && method === 'GET') {
      return await handleAdminGetLogs(req, res);
    }

    // 未匹配的路由
    return res.status(404).json(error('接口不存在', 404));
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json(error('服务器错误', 500));
  }
};

// ============================================
// 认证处理函数
// ============================================
async function handleRegister(req, res) {
  const { username, email, password, nickname } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json(error('用户名、邮箱和密码不能为空'));
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json(error('用户名长度需为 3-20 个字符'));
  }
  if (password.length < 6) {
    return res.status(400).json(error('密码长度不能少于 6 个字符'));
  }

  const { data: settings } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'allow_register')
    .single();

  if (settings && settings.setting_value === 'false') {
    return res.status(403).json(error('暂未开放注册', 403));
  }

  const { data: existingUser } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  if (existingUser) {
    return res.status(400).json(error('用户名已被注册'));
  }

  const { data: existingEmail } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (existingEmail) {
    return res.status(400).json(error('邮箱已被注册'));
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, nickname: nickname || username },
  });

  if (authError) {
    return res.status(400).json(error(authError.message || '注册失败'));
  }

  await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    username,
    email,
    nickname: nickname || username,
    role: 'user',
    status: 'active',
  });

  const { data: sessionData } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  return res.status(200).json(success({
    token: sessionData?.session?.access_token || '',
    user: {
      id: authData.user.id,
      username,
      email,
      nickname: nickname || username,
      role: 'user',
    },
  }, '注册成功'));
}

async function handleLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json(error('用户名和密码不能为空'));
  }

  let userEmail = username;

  if (!username.includes('@')) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, status')
      .eq('username', username)
      .single();

    if (!profile) {
      return res.status(400).json(error('用户名或密码错误'));
    }

    if (profile.status === 'banned') {
      return res.status(403).json(error('账号已被禁用', 403));
    }

    userEmail = profile.email;
  }

  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password,
  });

  if (authError) {
    return res.status(400).json(error('用户名或密码错误'));
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profile && profile.status === 'banned') {
    return res.status(403).json(error('账号已被禁用', 403));
  }

  await supabaseAdmin
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id);

  return res.status(200).json(success({
    token: data.session.access_token,
    user: {
      id: data.user.id,
      username: profile?.username || '',
      email: data.user.email,
      nickname: profile?.nickname || '',
      avatar: profile?.avatar || '',
      role: profile?.role || 'user',
    },
  }, '登录成功'));
}

async function handleGetProfile(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return res.status(200).json(success(profile));
}

async function handleUpdateProfile(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { nickname, avatar } = req.body;
  const updates = {};
  if (nickname !== undefined) updates.nickname = nickname;
  if (avatar !== undefined) updates.avatar = avatar;

  const { data: profile, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (updateError) {
    return res.status(400).json(error('更新失败'));
  }

  return res.status(200).json(success(profile, '更新成功'));
}

async function handleChangePassword(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json(error('请输入旧密码和新密码'));
  }
  if (newPassword.length < 6) {
    return res.status(400).json(error('新密码长度不能少于 6 个字符'));
  }

  const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  });

  if (signInError) {
    return res.status(400).json(error('旧密码错误'));
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    return res.status(400).json(error('密码修改失败'));
  }

  return res.status(200).json(success(null, '密码修改成功'));
}

// ============================================
// 游戏处理函数
// ============================================
async function handleGetGames(req, res) {
  const { page = 1, pageSize = 20, keyword, category_id, status } = req.query;
  const user = await optionalAuth(req);
  const isAdmin = user && user.profile.role === 'admin';
  const queryStatus = isAdmin ? status : 'approved';

  let query = supabaseAdmin
    .from('games')
    .select('*, categories(name)', { count: 'exact' });

  if (queryStatus) {
    query = query.eq('status', queryStatus);
  }
  if (category_id) {
    query = query.eq('category_id', Number(category_id));
  }
  if (keyword) {
    query = query.ilike('title', `%${keyword}%`);
  }

  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const from = (pageNum - 1) * pageSizeNum;
  const to = from + pageSizeNum - 1;

  const { data: games, count, error: queryError } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (queryError) {
    console.error('游戏列表查询错误:', queryError);
    return res.status(500).json(error('获取游戏列表失败', 500));
  }

  const list = (games || []).map(g => ({
    ...g,
    category_name: g.categories?.name || null,
  }));

  return res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
}

async function handleUploadGame(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { data: settings } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'allow_upload')
    .single();

  if (settings && settings.setting_value === 'false' && user.profile.role !== 'admin') {
    return res.status(403).json(error('暂不允许上传', 403));
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return res.status(400).json(error('无效的请求格式'));
  }

  const boundary = boundaryMatch[1];
  const parts = parseMultipart(buffer, boundary);

  const titlePart = parts.find(p => p.name === 'title');
  const categoryPart = parts.find(p => p.name === 'category_id');
  const descPart = parts.find(p => p.name === 'description');
  const romPart = parts.find(p => p.name === 'rom');

  if (!titlePart || !titlePart.value) {
    return res.status(400).json(error('游戏名称不能为空'));
  }
  if (!romPart || !romPart.data) {
    return res.status(400).json(error('请选择 ROM 文件'));
  }

  const title = titlePart.value;
  const category_id = categoryPart?.value ? Number(categoryPart.value) : null;
  const description = descPart?.value || '';

  const md5 = crypto.createHash('md5').update(romPart.data).digest('hex');

  const { data: existing } = await supabaseAdmin
    .from('games')
    .select('id, title')
    .eq('file_md5', md5)
    .single();

  if (existing) {
    return res.status(400).json(error(`该游戏已存在：${existing.title}`));
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.nes`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('roms')
    .upload(fileName, romPart.data, {
      contentType: 'application/octet-stream',
    });

  if (uploadError) {
    console.error('ROM 上传错误:', uploadError);
    return res.status(500).json(error('文件上传失败', 500));
  }

  const { data: statusSetting } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'default_game_status')
    .single();

  const gameStatus = user.profile.role === 'admin'
    ? (statusSetting?.setting_value || 'approved')
    : 'pending';

  const { data: game, error: createError } = await supabaseAdmin
    .from('games')
    .insert({
      title,
      category_id,
      description,
      rom_path: fileName,
      file_size: romPart.data.length,
      file_md5: md5,
      uploader_id: user.id,
      status: gameStatus,
    })
    .select()
    .single();

  if (createError) {
    console.error('创建游戏记录错误:', createError);
    return res.status(500).json(error('上传失败', 500));
  }

  return res.status(200).json(success({ id: game.id }, '上传成功，等待审核'));
}

async function handleGetGameDetail(req, res, path) {
  const id = path.split('/')[1];
  const user = await optionalAuth(req);

  const { data: game, error: queryError } = await supabaseAdmin
    .from('games')
    .select('*, categories(name)')
    .eq('id', id)
    .single();

  if (queryError || !game) {
    return res.status(404).json(error('游戏不存在', 404));
  }

  if (game.status !== 'approved' && (!user || user.profile.role !== 'admin')) {
    return res.status(404).json(error('游戏不存在', 404));
  }

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

  return res.status(200).json(success({
    ...game,
    category_name: game.categories?.name || null,
    isFavorited,
    comments: formattedComments,
  }));
}

async function handleDeleteGame(req, res, path) {
  const id = path.split('/')[1];
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

  if (game.uploader_id !== user.id && user.profile.role !== 'admin') {
    return res.status(403).json(error('没有权限删除', 403));
  }

  if (game.rom_path) {
    await supabaseAdmin.storage.from('roms').remove([game.rom_path]);
  }

  const { error: deleteError } = await supabaseAdmin
    .from('games')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return res.status(500).json(error('删除失败', 500));
  }

  return res.status(200).json(success(null, '删除成功'));
}

async function handleToggleFavorite(req, res, path) {
  const gameId = path.split('/')[1];
  const user = await requireAuth(req, res);
  if (!user) return;

  const { data: existing } = await supabaseAdmin
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .single();

  if (existing) {
    await supabaseAdmin.from('favorites').delete().eq('id', existing.id);
    return res.status(200).json(success({ favorited: false }, '已取消收藏'));
  } else {
    await supabaseAdmin.from('favorites').insert({ user_id: user.id, game_id: gameId });
    return res.status(200).json(success({ favorited: true }, '已收藏'));
  }
}

async function handlePostComment(req, res, path) {
  const gameId = path.split('/')[1];
  const user = await requireAuth(req, res);
  if (!user) return;

  const { content, rating } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json(error('评论内容不能为空'));
  }

  const { data: comment, error: insertError } = await supabaseAdmin
    .from('comments')
    .insert({
      user_id: user.id,
      game_id: gameId,
      content: content.trim(),
      rating: rating || null,
    })
    .select()
    .single();

  if (insertError) {
    return res.status(500).json(error('评论失败', 500));
  }

  if (rating) {
    const { data: avgData } = await supabaseAdmin
      .from('comments')
      .select('rating')
      .eq('game_id', gameId)
      .not('rating', 'is', null);

    if (avgData && avgData.length > 0) {
      const avg = avgData.reduce((sum, c) => sum + c.rating, 0) / avgData.length;
      await supabaseAdmin
        .from('games')
        .update({ rating: Math.round(avg * 10) / 10 })
        .eq('id', gameId);
    }
  }

  return res.status(200).json(success({ id: comment.id }, '评论成功'));
}

async function handleDownloadGame(req, res, path) {
  const id = path.split('/')[1];
  const user = await optionalAuth(req);

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', id)
    .single();

  if (!game) {
    return res.status(404).json(error('游戏不存在', 404));
  }

  if (game.status !== 'approved' && (!user || user.profile.role !== 'admin')) {
    return res.status(404).json(error('游戏不存在', 404));
  }

  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from('roms')
    .createSignedUrl(game.rom_path, 60);

  if (urlError || !urlData) {
    return res.status(404).json(error('ROM 文件不存在', 404));
  }

  await supabaseAdmin
    .from('games')
    .update({ play_count: (game.play_count || 0) + 1 })
    .eq('id', id);

  return res.redirect(302, urlData.signedUrl);
}

// ============================================
// 存档处理函数
// ============================================
async function handleGetSaves(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

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

  return res.status(200).json(success(list));
}

async function handleCreateSave(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { game_id, slot = 1, state_data, screenshot_path } = req.body;

  if (!game_id || !state_data) {
    return res.status(400).json(error('缺少游戏 ID 或存档数据'));
  }

  const { data: existing } = await supabaseAdmin
    .from('save_states')
    .select('id')
    .eq('user_id', user.id)
    .eq('game_id', game_id)
    .eq('slot', slot)
    .single();

  if (existing) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('save_states')
      .update({ state_data, screenshot_path })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json(error('存档失败', 500));
    }

    return res.status(200).json(success({ id: updated.id }, '存档成功'));
  } else {
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

    return res.status(200).json(success({ id: created.id }, '存档成功'));
  }
}

async function handleLoadSave(req, res, path) {
  const id = path.split('/')[2];
  const user = await requireAuth(req, res);
  if (!user) return;

  const { data: save, error: queryError } = await supabaseAdmin
    .from('save_states')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (queryError || !save) {
    return res.status(404).json(error('存档不存在', 404));
  }

  return res.status(200).json(success(save));
}

async function handleDeleteSave(req, res, path) {
  const id = path.split('/')[2];
  const user = await requireAuth(req, res);
  if (!user) return;

  const { error: deleteError } = await supabaseAdmin
    .from('save_states')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    return res.status(500).json(error('删除存档失败', 500));
  }

  return res.status(200).json(success(null, '存档已删除'));
}

// ============================================
// 分类处理函数
// ============================================
async function handleGetCategories(req, res) {
  const { data: categories, error: queryError } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (queryError) {
    return res.status(500).json(error('获取分类失败', 500));
  }

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

  return res.status(200).json(success(categoriesWithCount));
}

// ============================================
// 管理后台处理函数
// ============================================
async function handleAdminStats(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

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

  const { data: playData } = await supabaseAdmin.from('games').select('play_count');
  const totalPlays = (playData || []).reduce((sum, g) => sum + (g.play_count || 0), 0);

  const { count: totalSaves } = await supabaseAdmin.from('save_states').select('*', { count: 'exact', head: true });
  const { count: totalCategories } = await supabaseAdmin.from('categories').select('*', { count: 'exact', head: true });

  const today = new Date().toISOString().split('T')[0];
  const { count: todayUsers } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today);
  const { count: todayGames } = await supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).gte('created_at', today);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weeklyUsersData } = await supabaseAdmin.from('profiles').select('created_at').gte('created_at', sevenDaysAgo);
  const { data: weeklyGamesData } = await supabaseAdmin.from('games').select('created_at').gte('created_at', sevenDaysAgo);

  const { data: popularGames } = await supabaseAdmin.from('games').select('*').eq('status', 'approved').order('play_count', { ascending: false }).limit(5);
  const { data: recentGames } = await supabaseAdmin.from('games').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(5);

  return res.status(200).json(success({
    totalUsers: totalUsers || 0,
    totalGames: totalGames || 0,
    approvedGames: approvedGames || 0,
    pendingGames: pendingGames || 0,
    totalPlays,
    totalSaves: totalSaves || 0,
    totalCategories: totalCategories || 0,
    todayUsers: todayUsers || 0,
    todayGames: todayGames || 0,
    weeklyUsers: groupByDate(weeklyUsersData || []),
    weeklyGames: groupByDate(weeklyGamesData || []),
    popularGames: popularGames || [],
    recentGames: recentGames || [],
  }));
}

async function handleAdminGetUsers(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { page = 1, pageSize = 20, keyword, status } = req.query;
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const from = (pageNum - 1) * pageSizeNum;
  const to = from + pageSizeNum - 1;

  let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' });

  if (keyword) {
    query = query.or(`username.ilike.%${keyword}%,nickname.ilike.%${keyword}%,email.ilike.%${keyword}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data: users, count, error: queryError } = await query.order('created_at', { ascending: false }).range(from, to);

  if (queryError) {
    return res.status(500).json(error('获取用户列表失败', 500));
  }

  const list = (users || []).map(u => {
    const { password_hash, ...rest } = u;
    return rest;
  });

  return res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
}

async function handleAdminCreateUser(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { username, email, password, nickname, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json(error('用户名、邮箱和密码不能为空'));
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json(error('用户名长度需为 3-20 个字符'));
  }
  if (password.length < 6) {
    return res.status(400).json(error('密码长度不能少于 6 个字符'));
  }

  const { data: existingUser } = await supabaseAdmin.from('profiles').select('id').eq('username', username).single();
  if (existingUser) {
    return res.status(400).json(error('用户名已被注册'));
  }

  const { data: existingEmail } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
  if (existingEmail) {
    return res.status(400).json(error('邮箱已被注册'));
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return res.status(400).json(error(authError.message || '创建用户失败'));
  }

  await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    username,
    email,
    nickname: nickname || username,
    role: role && ['user', 'admin'].includes(role) ? role : 'user',
  });

  await logAdmin(user.id, 'create_user', 'user', authData.user.id, `新增用户：${username}`, req);
  return res.status(200).json(success({ id: authData.user.id }, '新增成功'));
}

async function handleAdminUpdateUser(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { nickname, email, role, status, password } = req.body;

  const { data: existing } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();
  if (!existing) {
    return res.status(404).json(error('用户不存在', 404));
  }

  const updates = {};
  if (nickname !== undefined) updates.nickname = nickname;
  if (email !== undefined) updates.email = email;
  if (role && ['user', 'admin'].includes(role)) updates.role = role;
  if (status && ['active', 'banned'].includes(status)) updates.status = status;

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from('profiles').update(updates).eq('id', id);
  }

  if (password && password.length >= 6) {
    await supabaseAdmin.auth.admin.updateUserById(id, { password });
  }

  await logAdmin(user.id, 'update_user', 'user', id, `编辑用户：${existing.username}`, req);
  return res.status(200).json(success(null, '更新成功'));
}

async function handleAdminDeleteUser(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  if (id === user.id) {
    return res.status(400).json(error('不能删除自己'));
  }

  const { data: existing } = await supabaseAdmin.from('profiles').select('username').eq('id', id).single();
  if (!existing) {
    return res.status(404).json(error('用户不存在', 404));
  }

  await supabaseAdmin.auth.admin.deleteUser(id);
  await logAdmin(user.id, 'delete_user', 'user', id, `删除用户：${existing.username}`, req);
  return res.status(200).json(success(null, '删除成功'));
}

async function handleAdminUpdateUserStatus(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { status } = req.body;

  if (!['active', 'banned'].includes(status)) {
    return res.status(400).json(error('无效的状态值'));
  }
  if (id === user.id) {
    return res.status(400).json(error('不能修改自己的状态'));
  }

  await supabaseAdmin.from('profiles').update({ status }).eq('id', id);
  await logAdmin(user.id, 'update_user_status', 'user', id, `将用户状态改为 ${status}`, req);
  return res.status(200).json(success(null, '操作成功'));
}

async function handleAdminUpdateUserRole(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json(error('无效的角色值'));
  }
  if (id === user.id) {
    return res.status(400).json(error('不能修改自己的角色'));
  }

  await supabaseAdmin.from('profiles').update({ role }).eq('id', id);
  await logAdmin(user.id, 'update_user_role', 'user', id, `将用户角色改为 ${role}`, req);
  return res.status(200).json(success(null, '操作成功'));
}

async function handleAdminGetGames(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { page = 1, pageSize = 20, keyword, status, category_id } = req.query;
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const from = (pageNum - 1) * pageSizeNum;
  const to = from + pageSizeNum - 1;

  let query = supabaseAdmin.from('games').select('*, categories(name)', { count: 'exact' });

  if (keyword) {
    query = query.ilike('title', `%${keyword}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (category_id) {
    query = query.eq('category_id', Number(category_id));
  }

  const { data: games, count, error: queryError } = await query.order('created_at', { ascending: false }).range(from, to);

  if (queryError) {
    return res.status(500).json(error('获取游戏列表失败', 500));
  }

  const list = (games || []).map(g => ({
    ...g,
    category_name: g.categories?.name || null,
  }));

  return res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
}

async function handleAdminCreateGame(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);

  let title, category_id, description, gameStatus, romData;

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = parseMultipart(buffer, boundary);

    const titlePart = parts.find(p => p.name === 'title');
    const categoryPart = parts.find(p => p.name === 'category_id');
    const descPart = parts.find(p => p.name === 'description');
    const statusPart = parts.find(p => p.name === 'status');
    const romPart = parts.find(p => p.name === 'rom');

    title = titlePart?.value;
    category_id = categoryPart?.value ? Number(categoryPart.value) : null;
    description = descPart?.value || '';
    gameStatus = statusPart?.value || 'approved';
    romData = romPart?.data;
  } else {
    const body = JSON.parse(buffer.toString());
    title = body.title;
    category_id = body.category_id ? Number(body.category_id) : null;
    description = body.description || '';
    gameStatus = body.status || 'approved';
  }

  if (!title) {
    return res.status(400).json(error('游戏名称不能为空'));
  }

  let romPath = '';
  let fileSize = 0;
  let md5 = null;

  if (romData) {
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.nes`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('roms')
      .upload(fileName, romData, { contentType: 'application/octet-stream' });

    if (uploadError) {
      return res.status(500).json(error('文件上传失败', 500));
    }

    romPath = fileName;
    fileSize = romData.length;
    md5 = crypto.createHash('md5').update(romData).digest('hex');

    const { data: existing } = await supabaseAdmin.from('games').select('id, title').eq('file_md5', md5).single();
    if (existing) {
      return res.status(400).json(error(`该游戏已存在：${existing.title}`));
    }
  }

  const { data: game, error: createError } = await supabaseAdmin
    .from('games')
    .insert({
      title,
      category_id,
      description,
      rom_path: romPath,
      file_size: fileSize,
      file_md5: md5,
      uploader_id: user.id,
      status: gameStatus || 'approved',
    })
    .select()
    .single();

  if (createError) {
    return res.status(500).json(error('新增游戏失败', 500));
  }

  await logAdmin(user.id, 'create_game', 'game', game.id, `新增游戏：${title}`, req);
  return res.status(200).json(success({ id: game.id }, '新增成功'));
}

async function handleAdminUpdateGame(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { title, category_id, description, status } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (category_id !== undefined) updates.category_id = Number(category_id);
  if (description !== undefined) updates.description = description;
  if (status && ['pending', 'approved', 'rejected', 'banned'].includes(status)) {
    updates.status = status;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabaseAdmin.from('games').update(updates).eq('id', id);
    if (updateError) {
      return res.status(500).json(error('编辑游戏失败', 500));
    }
  }

  await logAdmin(user.id, 'update_game', 'game', id, `编辑游戏 #${id}`, req);
  return res.status(200).json(success(null, '更新成功'));
}

async function handleAdminDeleteGame(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { data: game } = await supabaseAdmin.from('games').select('title, rom_path').eq('id', id).single();

  if (!game) {
    return res.status(404).json(error('游戏不存在', 404));
  }

  if (game.rom_path) {
    await supabaseAdmin.storage.from('roms').remove([game.rom_path]);
  }

  await supabaseAdmin.from('games').delete().eq('id', id);
  await logAdmin(user.id, 'delete_game', 'game', id, `删除游戏：${game.title}`, req);
  return res.status(200).json(success(null, '删除成功'));
}

async function handleAdminUpdateGameStatus(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { status } = req.body;

  if (!['approved', 'rejected', 'banned'].includes(status)) {
    return res.status(400).json(error('无效的状态值'));
  }

  await supabaseAdmin.from('games').update({ status }).eq('id', id);
  await logAdmin(user.id, 'review_game', 'game', id, `将游戏审核状态改为 ${status}`, req);
  return res.status(200).json(success(null, '操作成功'));
}

async function handleAdminCreateCategory(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { name, slug, icon, sort_order } = req.body;
  if (!name || !slug) {
    return res.status(400).json(error('分类名称和标识不能为空'));
  }

  const { data: existing } = await supabaseAdmin.from('categories').select('id').eq('slug', slug).single();
  if (existing) {
    return res.status(400).json(error('分类标识已存在'));
  }

  const { data: category, error: createError } = await supabaseAdmin
    .from('categories')
    .insert({ name, slug, icon: icon || '🎮', sort_order: sort_order || 0 })
    .select()
    .single();

  if (createError) {
    return res.status(500).json(error('新增分类失败', 500));
  }

  await logAdmin(user.id, 'create_category', 'category', category.id, `新增分类：${name}`, req);
  return res.status(200).json(success({ id: category.id }, '新增成功'));
}

async function handleAdminUpdateCategory(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { name, slug, icon, sort_order } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (icon !== undefined) updates.icon = icon;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabaseAdmin.from('categories').update(updates).eq('id', id);
    if (updateError) {
      return res.status(500).json(error('更新分类失败', 500));
    }
  }

  await logAdmin(user.id, 'update_category', 'category', id, `编辑分类：${name || ''}`, req);
  return res.status(200).json(success(null, '更新成功'));
}

async function handleAdminDeleteCategory(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  await supabaseAdmin.from('categories').delete().eq('id', id);
  await logAdmin(user.id, 'delete_category', 'category', id, '删除分类', req);
  return res.status(200).json(success(null, '删除成功'));
}

async function handleAdminGetComments(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { page = 1, pageSize = 20, game_id } = req.query;
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const from = (pageNum - 1) * pageSizeNum;
  const to = from + pageSizeNum - 1;

  let query = supabaseAdmin.from('comments').select('*, profiles(username, nickname), games(title)', { count: 'exact' });

  if (game_id) {
    query = query.eq('game_id', game_id);
  }

  const { data: comments, count, error: queryError } = await query.order('created_at', { ascending: false }).range(from, to);

  if (queryError) {
    return res.status(500).json(error('获取评论列表失败', 500));
  }

  const list = (comments || []).map(c => ({
    ...c,
    nickname: c.profiles?.nickname || c.profiles?.username,
    game_title: c.games?.title,
  }));

  return res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
}

async function handleAdminUpdateCommentStatus(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  const { status } = req.body;

  if (!['visible', 'hidden'].includes(status)) {
    return res.status(400).json(error('无效的状态值'));
  }

  await supabaseAdmin.from('comments').update({ status }).eq('id', id);
  return res.status(200).json(success(null, '操作成功'));
}

async function handleAdminDeleteComment(req, res, path) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = path.split('/')[2];
  await supabaseAdmin.from('comments').delete().eq('id', id);
  return res.status(200).json(success(null, '删除成功'));
}

async function handleAdminGetSettings(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { data: settings, error: queryError } = await supabaseAdmin.from('system_settings').select('*').order('id');

  if (queryError) {
    return res.status(500).json(error('获取设置失败', 500));
  }

  return res.status(200).json(success(settings));
}

async function handleAdminUpdateSettings(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { settings } = req.body;
  if (!Array.isArray(settings)) {
    return res.status(400).json(error('参数格式错误'));
  }

  for (const item of settings) {
    await supabaseAdmin.from('system_settings').update({ setting_value: item.setting_value }).eq('setting_key', item.setting_key);
  }

  await logAdmin(user.id, 'update_settings', 'system', null, `更新了 ${settings.length} 项设置`, req);
  return res.status(200).json(success(null, '设置已保存'));
}

async function handleAdminGetLogs(req, res) {
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

  return res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
}

// ============================================
// 工具函数
// ============================================
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let pos = 0;

  while (pos < buffer.length) {
    const boundaryPos = buffer.indexOf(boundaryBuf, pos);
    if (boundaryPos === -1) break;

    const headerEnd = buffer.indexOf('\r\n\r\n', boundaryPos);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(boundaryPos + boundaryBuf.length + 2, headerEnd).toString();
    const nextBoundary = buffer.indexOf(boundaryBuf, headerEnd + 4);
    if (nextBoundary === -1) break;

    const content = buffer.slice(headerEnd + 4, nextBoundary - 2);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    if (nameMatch) {
      const part = { name: nameMatch[1] };
      if (filenameMatch) {
        part.data = content;
      } else {
        part.value = content.toString();
      }
      parts.push(part);
    }

    pos = nextBoundary;
  }

  return parts;
}

function groupByDate(items) {
  const groups = {};
  items.forEach(item => {
    const date = item.created_at.split('T')[0];
    groups[date] = (groups[date] || 0) + 1;
  });
  return Object.entries(groups).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

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
