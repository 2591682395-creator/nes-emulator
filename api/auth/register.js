const { supabaseAdmin } = require('../../lib/supabase');
const { success, error } = require('../../lib/response');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许', 405));
  }

  try {
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

    // 检查是否允许注册
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'allow_register')
      .single();

    if (settings && settings.setting_value === 'false') {
      return res.status(403).json(error('暂未开放注册', 403));
    }

    // 检查用户名唯一性
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json(error('用户名已被注册'));
    }

    // 检查邮箱唯一性
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return res.status(400).json(error('邮箱已被注册'));
    }

    // 使用 Supabase Auth 创建用户
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, nickname: nickname || username },
    });

    if (authError) {
      return res.status(400).json(error(authError.message || '注册失败'));
    }

    // 创建 profile 记录
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        username,
        email,
        nickname: nickname || username,
        role: 'user',
        status: 'active',
      });

    if (profileError) {
      console.error('创建 profile 失败:', profileError);
    }

    // 登录获取 token
    const { data: loginData, error: loginError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    // 直接用 signInWithPassword 获取 token
    const { data: sessionData } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    res.status(200).json(success({
      token: sessionData?.session?.access_token || '',
      user: {
        id: authData.user.id,
        username,
        email,
        nickname: nickname || username,
        role: 'user',
      },
    }, '注册成功'));
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json(error('注册失败', 500));
  }
};
