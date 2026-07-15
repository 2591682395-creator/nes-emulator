const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/games', require('./routes/games'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/admin', require('./routes/admin'));

// 前台页面 - 默认返回 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 后台管理页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// 兜底 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ code: 404, message: '接口不存在' });
  } else {
    res.status(404).send('页面不存在');
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);

  // multer 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ code: 400, message: '文件大小超出限制' });
  }

  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🎮 NES 模拟器后端服务已启动: http://localhost:${PORT}`);
  console.log(`📊 管理后台: http://localhost:${PORT}/admin`);
  console.log(`📝 API 地址: http://localhost:${PORT}/api`);
});
