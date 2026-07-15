const { supabaseAdmin } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/auth');
const { success, error, paginated } = require('../../lib/response');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      // 用户列表
      const { page = 1, pageSize = 20, keyword, status } = req.query;
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const from = (pageNum - 1) * pageSizeNum;
      const to = from + pageSizeNum - 1;

      let query = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' });

      if (keyword) {
        query = query.or(`username.ilike.%${keyword}%,nickname.ilike.%${keyword}%,email.ilike.%${keyword}%`);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data: users, count, error: queryError } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (queryError) {
        return res.status(500).json(error('获取用户列表失败', 500));
      }

      // 移除敏感信息
      const list = (users || []).map(u => {
        const { password_hash, ...rest } = u;
        return rest;
      });

      res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
    } else if (req.method === 'POST') {
      // 新增用户
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

      // 检查唯一性
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

      // 创建 Auth 用户
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return res.status(400).json(error(authError.message || '创建用户失败'));
      }

      // 创建 profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          email,
          nickname: nickname || username,
          role: role && ['user', 'admin'].includes(role) ? role : 'user',
        });

      if (profileError) {
        return res.status(500).json(error('创建用户失败', 500));
      }

      await logAdmin(user.id, 'create_user', 'user', authData.user.id, `新增用户：${username}`, req);
      res.status(200).json(success({ id: authData.user.id }, '新增成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('用户管理错误:', err);
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
