# NES 红白机浏览器模拟器 - MVP

在浏览器中运行 NES 红白机游戏的完整平台，包含前端模拟器、后端 API 服务、后台管理系统。

## 快速开始

### 1. 环境要求

- Node.js >= 16
- MySQL >= 5.7

### 2. 数据库初始化

```bash
# 登录 MySQL 后执行建表脚本
mysql -u root -p < server/init.sql
```

默认管理员账号：`admin` / `admin123`

### 3. 启动后端服务

```bash
cd server
npm install
npm start
```

服务启动后：
- 🎮 前台地址: http://localhost:3000
- 📊 管理后台: http://localhost:3000/admin
- 📝 API 地址: http://localhost:3000/api

### 4. 加载游戏

1. 打开前台页面
2. 注册/登录账号
3. 点击「📂 加载 ROM」选择 `.nes`、`.gb`、`.gbc` 或 `.gba` 文件
4. 管理员在后台审核通过后即可游玩

## 键位说明

| 功能 | 玩家 1 | 玩家 2 |
|------|--------|--------|
| 方向 | ↑ ↓ ← → | W A S D |
| A 键 | Z | J |
| B 键 | X | K |
| Start | Enter | U |
| Select | Right Shift | I |

## 技术栈

### 前端
- **模拟器引擎**: EmulatorJS（NES / GB / GBC / GBA 多核心）
- **渲染**: Canvas 2D API
- **音频**: Web Audio API (AudioWorklet)
- **后台管理**: React 18 + antd 5 (CDN)

### 后端
- **运行时**: Node.js + Express
- **数据库**: MySQL
- **认证**: JWT (jsonwebtoken)
- **文件上传**: multer

## 项目结构

```
code/01_mvp/
├── index.html                 # 前台主页
├── css/style.css              # 前台样式
├── js/                        # 前台脚本
│   ├── app.js                 # 主应用入口与游戏切换
│   └── emulator.js            # EmulatorJS 多核心封装
├── player.html                # 隔离运行 NES/GB/GBC/GBA 核心
├── admin/
│   └── index.html             # 管理后台 (React + antd)
├── server/
│   ├── app.js                 # Express 主入口
│   ├── init.sql               # 数据库建表脚本
│   ├── config/db.js           # 数据库连接
│   ├── middleware/
│   │   ├── auth.js            # JWT 认证
│   │   └── upload.js          # 文件上传
│   ├── models/
│   │   ├── user.js            # 用户模型
│   │   ├── game.js            # 游戏模型
│   │   ├── category.js        # 分类模型
│   │   └── saveState.js       # 存档模型
│   ├── routes/
│   │   ├── auth.js            # 认证接口
│   │   ├── games.js           # 游戏接口
│   │   ├── categories.js      # 分类接口
│   │   └── admin.js           # 管理接口
│   └── utils/response.js      # 统一响应
├── uploads/                   # 上传文件存储
│   ├── roms/
│   └── covers/
└── previews/                  # 前端方案预览
```

## API 接口

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/auth/profile | 个人信息 |
| PUT | /api/auth/profile | 更新信息 |
| PUT | /api/auth/password | 修改密码 |

### 游戏
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/games | 游戏列表 |
| GET | /api/games/:id | 游戏详情 |
| POST | /api/games | 上传游戏 |
| DELETE | /api/games/:id | 删除游戏 |
| POST | /api/games/:id/favorite | 收藏 |
| POST | /api/games/:id/comments | 评论 |
| GET | /api/games/:id/download | 下载 ROM |

### 存档
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/saves/list | 存档列表 |
| POST | /api/saves | 保存进度 |
| POST | /api/saves/:id/load | 加载存档 |
| DELETE | /api/saves/:id | 删除存档 |

### 管理后台
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/stats | 系统统计 |
| GET/PUT | /api/admin/users | 用户管理 |
| GET/PUT/DELETE | /api/admin/games | 游戏管理 |
| POST/PUT/DELETE | /api/admin/categories | 分类管理 |
| GET/PUT/DELETE | /api/admin/comments | 评论管理 |
| GET/PUT | /api/admin/settings | 系统设置 |
| GET | /api/admin/logs | 操作日志 |

## 数据库表结构

| 表名 | 说明 |
|------|------|
| users | 用户表 |
| games | 游戏表 |
| categories | 游戏分类表 |
| save_states | 存档表 |
| favorites | 收藏表 |
| comments | 评论表 |
| system_settings | 系统设置表 |
| admin_logs | 管理日志表 |
# Last updated: Thu Jul 16 10:36:08     2026
# Redeploy at Thu Jul 16 10:54:22     2026
