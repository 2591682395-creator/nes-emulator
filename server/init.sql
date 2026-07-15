-- ============================================
-- NES 模拟器数据库初始化脚本
-- ============================================

CREATE DATABASE IF NOT EXISTS nes_emulator
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE nes_emulator;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  avatar VARCHAR(255) DEFAULT '/uploads/default-avatar.png',
  role ENUM('user', 'admin') DEFAULT 'user',
  status ENUM('active', 'banned') DEFAULT 'active',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. 游戏分类表
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  icon VARCHAR(10) DEFAULT '🎮',
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. 游戏表
CREATE TABLE IF NOT EXISTS games (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  category_id INT,
  description TEXT,
  rom_path VARCHAR(500) NOT NULL,
  cover_path VARCHAR(500),
  file_size INT DEFAULT 0,
  file_md5 VARCHAR(32),
  region VARCHAR(20) DEFAULT 'NES',
  play_count INT DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  status ENUM('pending', 'approved', 'rejected', 'banned') DEFAULT 'pending',
  uploader_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_category (category_id),
  INDEX idx_uploader (uploader_id)
) ENGINE=InnoDB;

-- 4. 存档表
CREATE TABLE IF NOT EXISTS save_states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  game_id INT NOT NULL,
  slot TINYINT DEFAULT 1,
  state_data LONGTEXT,
  screenshot_path VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_game_slot (user_id, game_id, slot)
) ENGINE=InnoDB;

-- 5. 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  game_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_game (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  game_id INT NOT NULL,
  content TEXT NOT NULL,
  rating TINYINT CHECK (rating >= 1 AND rating <= 5),
  status ENUM('visible', 'hidden') DEFAULT 'visible',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_game (game_id)
) ENGINE=InnoDB;

-- 7. 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description VARCHAR(200),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 8. 管理日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(30),
  target_id INT,
  detail TEXT,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ============================================
-- 初始数据
-- ============================================

-- 默认管理员 (密码: admin123，bcrypt 加密)
INSERT INTO users (username, email, password_hash, nickname, role) VALUES
('admin', 'admin@nes.local', '$2a$10$x3L38fUe8JoM6oL5lNByXuQzTDuPwXweZahZrUqpfmvpQ77ytkpPW', 'Admin', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- 默认分类
INSERT INTO categories (name, slug, icon, sort_order) VALUES
('动作', 'action', '[A]', 1),
('冒险', 'adventure', '[B]', 2),
('射击', 'shooter', '[C]', 3),
('平台跳跃', 'platformer', '[D]', 4),
('格斗', 'fighting', '[E]', 5),
('益智', 'puzzle', '[F]', 6),
('体育', 'sports', '[G]', 7),
('赛车', 'racing', '[H]', 8),
('角色扮演', 'rpg', '[I]', 9),
('策略', 'strategy', '[J]', 10),
('其他', 'other', '[K]', 99)
ON DUPLICATE KEY UPDATE name=name;

-- 默认系统设置
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'NES 红白机模拟器', 'string', '站点名称'),
('site_description', '在浏览器中重温经典游戏', 'string', '站点描述'),
('allow_register', 'true', 'boolean', '是否允许用户注册'),
('allow_upload', 'true', 'boolean', '是否允许用户上传 ROM'),
('maintenance_mode', 'false', 'boolean', '维护模式'),
('max_upload_size', '10', 'number', '最大上传大小(MB)'),
('default_game_status', 'approved', 'string', '新上传游戏默认审核状态')
ON DUPLICATE KEY UPDATE setting_key=setting_key;
