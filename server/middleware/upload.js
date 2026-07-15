const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDirs = ['uploads/roms', 'uploads/covers'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '../../', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// ROM 文件存储配置
const romStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/roms'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// 封面图片存储配置
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/covers'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// ROM 文件过滤器
function romFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.nes', '.gb', '.gbc', '.gba'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 .nes、.gb、.gbc 和 .gba 格式的 ROM 文件'), false);
  }
}

// 图片文件过滤器
function imageFilter(req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 JPG/PNG/WebP/GIF 格式的图片'), false);
  }
}

const uploadROM = multer({
  storage: romStorage,
  limits: { fileSize: 64 * 1024 * 1024 }, // GBA ROM 最大通常为 32MB
  fileFilter: romFilter,
});

const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});

module.exports = { uploadROM, uploadCover };
