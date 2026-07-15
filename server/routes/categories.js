const express = require('express');
const Category = require('../models/category');
const { success, error } = require('../utils/response');

const router = express.Router();

// GET /api/categories - 获取所有分类
router.get('/', async (req, res) => {
  try {
    const categories = await Category.findAll();
    success(res, categories);
  } catch (err) {
    console.error('获取分类错误:', err);
    error(res, '获取分类失败', 500, 500);
  }
});

module.exports = router;
