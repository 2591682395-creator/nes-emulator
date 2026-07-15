/**
 * 统一 API 响应格式
 */

function success(res, data = null, message = '操作成功') {
  return res.json({
    code: 0,
    message,
    data,
  });
}

function error(res, message = '操作失败', code = 400, httpStatus = 400) {
  return res.status(httpStatus).json({
    code,
    message,
    data: null,
  });
}

function paginated(res, { list, total, page, pageSize }) {
  return res.json({
    code: 0,
    message: 'ok',
    data: {
      list,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

module.exports = { success, error, paginated };
