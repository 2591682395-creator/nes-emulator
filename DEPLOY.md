# NES 模拟器 - Vercel + Supabase 部署指南

## 前置准备

1. **Supabase 账号**: https://supabase.com
2. **Vercel 账号**: https://vercel.com
3. **GitHub 账号**: 用于代码托管

---

## 第一步: Supabase 项目设置

### 1.1 创建 Supabase 项目

1. 登录 Supabase 控制台
2. 点击 "New Project"
3. 选择组织，输入项目名称 (如 `nes-emulator`)
4. 设置数据库密码 (请记住)
5. 选择区域 (建议选择离用户近的区域)
6. 点击 "Create Project"

### 1.2 创建数据库表

1. 在 Supabase 控制台，进入 SQL Editor
2. 点击 "New Query"
3. 复制 `supabase/schema.sql` 文件的内容
4. 粘贴到编辑器中
5. 点击 "Run" 执行

### 1.3 创建 Storage Bucket

1. 在左侧菜单选择 Storage
2. 点击 "New Bucket"
3. 创建第一个 bucket:
   - Name: `roms`
   - Public bucket: ✅ 勾选
   - 点击 "Create Bucket"
4. 创建第二个 bucket:
   - Name: `covers`
   - Public bucket: ✅ 勾选
   - 点击 "Create Bucket"

### 1.4 获取 API 密钥

1. 在左侧菜单选择 Settings → API
2. 复制以下信息:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role secret key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

⚠️ **注意**: `service_role` 密钥具有完全访问权限，请妥善保管，不要泄露!

---

## 第二步: Vercel 部署

### 2.1 推送代码到 GitHub

```bash
cd code/01_mvp
git init
git add .
git commit -m "Initial commit: NES emulator for Vercel + Supabase"
git remote add origin https://github.com/YOUR_USERNAME/nes-emulator.git
git push -u origin main
```

### 2.2 在 Vercel 导入项目

1. 登录 Vercel: https://vercel.com
2. 点击 "Add New..." → "Project"
3. 选择你的 GitHub 仓库
4. 配置项目:
   - **Framework Preset**: Other
   - **Root Directory**: `code/01_mvp` (如果仓库包含多个项目)
   - **Build Command**: 留空 (使用默认)
   - **Output Directory**: 留空 (使用默认)

### 2.3 配置环境变量

在 Vercel 项目设置中，进入 Settings → Environment Variables，添加:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### 2.4 部署

1. 点击 "Deploy" 按钮
2. 等待部署完成
3. 部署成功后，Vercel 会提供一个域名 (如 `nes-emulator.vercel.app`)

---

## 第三步: 创建管理员账号

由于 Supabase Auth 不允许直接通过 API 创建用户，你需要:

1. 访问你的网站: `https://nes-emulator.vercel.app`
2. 点击注册，创建一个普通用户账号
3. 在 Supabase 控制台，进入 SQL Editor，执行:

```sql
-- 将刚注册的用户设为管理员
UPDATE profiles
SET role = 'admin'
WHERE username = '你的用户名';
```

4. 现在可以访问管理后台: `https://nes-emulator.vercel.app/admin`

---

## 第四步: 上传游戏 ROM

1. 登录管理后台
2. 进入 "游戏管理" 页面
3. 点击 "新增游戏"
4. 填写游戏信息，上传 `.nes`、`.gb`、`.gbc` 或 `.gba` ROM 文件
5. 点击确认上传

---

## 常见问题

### Q: 上传 ROM 失败怎么办?

A: 检查以下几点:
- Supabase Storage bucket 是否创建为 Public
- ROM 文件大小是否超过 10MB
- 环境变量是否正确配置

### Q: 登录失败怎么办?

A: 检查以下几点:
- Supabase Auth 是否正常工作
- 用户是否在 `profiles` 表中有记录
- 用户状态是否为 `active`

### Q: 如何查看日志?

A: 在 Vercel 控制台，进入项目 → Functions，可以查看 API 函数的运行日志。

### Q: 如何更新部署?

A: 推送代码到 GitHub 后，Vercel 会自动重新部署:

```bash
git add .
git commit -m "Update: description of changes"
git push
```

---

## 项目结构

```
code/01_mvp/
├── api/                    # Vercel Serverless Functions
│   ├── auth/              # 认证相关 API
│   ├── games/             # 游戏相关 API
│   ├── admin/             # 管理后台 API
│   └── categories.js      # 分类 API
├── lib/                    # 共享工具库
│   ├── supabase.js        # Supabase 客户端
│   ├── auth.js            # 认证中间件
│   └── response.js        # 响应格式
├── public/                 # 静态前端文件
│   ├── index.html         # 主页面
│   ├── js/                # JavaScript 文件
│   ├── css/               # 样式文件
│   └── admin/             # 管理后台
├── supabase/               # Supabase 配置
│   └── schema.sql         # 数据库 schema
├── package.json            # 项目依赖
├── vercel.json             # Vercel 配置
└── .env.example            # 环境变量示例
```

---

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Vercel Serverless Functions (Node.js)
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **存储**: Supabase Storage
- **部署**: Vercel

---

## 许可证

MIT
