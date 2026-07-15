const { supabase, supabaseAdmin } = require('./supabase');
const { error } = require('./response');

/**
 * 认证中间件 - 从 Authorization header 解析 Supabase JWT
 * 返回用户信息和 profile
 */
async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return null;

    // 获取 profile 信息
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status === 'banned') return null;

    return { ...user, profile };
  } catch (e) {
    return null;
  }
}

/**
 * 要求认证 - 未认证返回 401
 */
async function requireAuth(req, res) {
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json(error('未登录或 token 已过期', 401));
    return null;
  }
  return user;
}

/**
 * 要求管理员权限
 */
async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.profile.role !== 'admin') {
    res.status(403).json(error('权限不足', 403));
    return null;
  }
  return user;
}

/**
 * 可选认证 - 未认证也能访问
 */
async function optionalAuth(req) {
  return await authenticate(req);
}

module.exports = { authenticate, requireAuth, requireAdmin, optionalAuth };
