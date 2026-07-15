function success(data, message = '操作成功') {
  return { code: 0, message, data };
}

function error(message = '操作失败', code = 400) {
  return { code, message, data: null };
}

function paginated(list, total, page, pageSize) {
  return {
    code: 0,
    message: 'ok',
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

module.exports = { success, error, paginated };
