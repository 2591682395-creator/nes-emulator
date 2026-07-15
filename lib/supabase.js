const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 普通客户端 (使用 anon key，受 RLS 限制)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 管理客户端 (使用 service_role key，绕过 RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase, supabaseAdmin };
