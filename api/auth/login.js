const { supabase, supabaseAdmin } = require('../../lib/supabase');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(error('用户名和密码不能为空'));
    }

    // 先通过 username 找到 email
    let userEmail = username;

    // 如果不包含 @，则按用户名查找
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

    // 使用 Supabase Auth 登录
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (authError) {
      return res.status(400).json(error('用户名或密码错误'));
    }

    // 获取 profile 信息
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profile && profile.status === 'banned') {
      return res.status(403).json(error('账号已被禁用', 403));
    }

    // 更新最后登录时间
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    res.status(200).json(success({
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
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json(error('登录失败', 500));
  }
};
