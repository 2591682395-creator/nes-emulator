const QINIU_PREFIX = 'qiniu:';
const DEFAULT_QINIU_BASE_URL = 'https://qiniu.tianyaknise.top';

function isQiniuPath(value) {
  return String(value || '').startsWith(QINIU_PREFIX);
}

function qiniuPath(key) {
  return `${QINIU_PREFIX}${String(key).replace(/^\/+/, '')}`;
}

function qiniuUrl(storagePath) {
  const baseUrl = String(process.env.QINIU_BASE_URL || DEFAULT_QINIU_BASE_URL).replace(/\/+$/, '');
  const key = String(storagePath).slice(QINIU_PREFIX.length).replace(/^\/+/, '');
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/${encodedKey}`;
}

module.exports = { isQiniuPath, qiniuPath, qiniuUrl };
