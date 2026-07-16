-- ============================================
-- NES 模拟器 PostgreSQL Schema (Supabase)
-- ============================================

-- 1. 用户配置表 (Supabase Auth 管理认证，此表存储额外信息)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  nickname VARCHAR(50),
  avatar VARCHAR(500) DEFAULT '/uploads/default-avatar.png',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'banned')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 游戏分类表
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  icon VARCHAR(10) DEFAULT '🎮',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 游戏表
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  rom_path VARCHAR(500) NOT NULL,
  cover_path VARCHAR(500),
  file_size INT DEFAULT 0,
  file_md5 VARCHAR(32),
  region VARCHAR(20) DEFAULT 'NES',
  play_count INT DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'banned')),
  uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_category ON games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_uploader ON games(uploader_id);

-- 4. 存档表
CREATE TABLE IF NOT EXISTS save_states (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  slot SMALLINT DEFAULT 1,
  state_data TEXT,
  screenshot_path VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, slot)
);

-- 长期云存档索引；二进制内容存放在私有 saves Storage bucket。
CREATE TABLE IF NOT EXISTS game_saves (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  rom_hash VARCHAR(64) NOT NULL,
  core VARCHAR(20) NOT NULL,
  save_type VARCHAR(20) NOT NULL CHECK (save_type IN ('sram', 'state')),
  slot VARCHAR(24) NOT NULL DEFAULT 'auto',
  storage_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  checksum VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, rom_hash, slot)
);
CREATE INDEX IF NOT EXISTS idx_game_saves_user_game ON game_saves(user_id, game_id);

-- 5. 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- 6. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_game ON comments(game_id);

-- 7. 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description VARCHAR(200),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 管理日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(30),
  target_id VARCHAR(50),
  detail TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);

-- ============================================
-- 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_games_updated
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_settings_updated
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- profiles: 用户可读所有，只能改自己的
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- games: 所有人可读 approved，认证用户可插入，作者/管理员可改
CREATE POLICY "games_select" ON games FOR SELECT USING (status = 'approved' OR auth.uid() = uploader_id);
CREATE POLICY "games_insert" ON games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "games_update" ON games FOR UPDATE USING (auth.uid() = uploader_id);
CREATE POLICY "games_delete" ON games FOR DELETE USING (auth.uid() = uploader_id);

-- categories: 所有人可读
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);

-- save_states: 用户只能访问自己的
CREATE POLICY "saves_select" ON save_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saves_insert" ON save_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saves_update" ON save_states FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "saves_delete" ON save_states FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "game_saves_select" ON game_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "game_saves_insert" ON game_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_saves_update" ON game_saves FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "game_saves_delete" ON game_saves FOR DELETE USING (auth.uid() = user_id);

-- favorites: 用户只能访问自己的
CREATE POLICY "favorites_select" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- comments: 所有人可读 visible，认证用户可插入
CREATE POLICY "comments_select" ON comments FOR SELECT USING (status = 'visible');
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- system_settings: 所有人可读
CREATE POLICY "settings_select" ON system_settings FOR SELECT USING (true);

-- admin_logs: 无公开访问（通过 service_role 访问）

-- ============================================
-- 初始数据
-- ============================================

-- 默认分类
INSERT INTO categories (name, slug, icon, sort_order) VALUES
('动作', 'action', '🎮', 1),
('冒险', 'adventure', '🗺️', 2),
('射击', 'shooter', '🔫', 3),
('平台跳跃', 'platformer', '🏃', 4),
('格斗', 'fighting', '🥊', 5),
('益智', 'puzzle', '🧩', 6),
('体育', 'sports', '⚽', 7),
('赛车', 'racing', '🏎️', 8),
('角色扮演', 'rpg', '⚔️', 9),
('策略', 'strategy', '♟️', 10),
('其他', 'other', '📦', 99)
ON CONFLICT (slug) DO NOTHING;

-- 默认系统设置
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'NES 红白机模拟器', 'string', '站点名称'),
('site_description', '在浏览器中重温经典游戏', 'string', '站点描述'),
('allow_register', 'true', 'boolean', '是否允许用户注册'),
('allow_upload', 'true', 'boolean', '是否允许用户上传 ROM'),
('maintenance_mode', 'false', 'boolean', '维护模式'),
('max_upload_size', '10', 'number', '最大上传大小(MB)'),
('default_game_status', 'approved', 'string', '新上传游戏默认审核状态')
ON CONFLICT (setting_key) DO NOTHING;
