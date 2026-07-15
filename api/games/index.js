const { supabase, supabaseAdmin } = require('../../lib/supabase');
const { requireAuth, optionalAuth } = require('../../lib/auth');
const { success, error, paginated } = require('../../lib/response');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // 获取游戏列表
      const { page = 1, pageSize = 20, keyword, category_id, status } = req.query;
      const user = await optionalAuth(req);
      const isAdmin = user && user.profile.role === 'admin';
      const queryStatus = isAdmin ? status : 'approved';

      let query = supabaseAdmin
        .from('games')
        .select('*, categories(name)', { count: 'exact' });

      if (queryStatus) {
        query = query.eq('status', queryStatus);
      }
      if (category_id) {
        query = query.eq('category_id', Number(category_id));
      }
      if (keyword) {
        query = query.ilike('title', `%${keyword}%`);
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const from = (pageNum - 1) * pageSizeNum;
      const to = from + pageSizeNum - 1;

      const { data: games, count, error: queryError } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (queryError) {
        console.error('游戏列表查询错误:', queryError);
        return res.status(500).json(error('获取游戏列表失败', 500));
      }

      // 格式化数据
      const list = (games || []).map(g => ({
        ...g,
        category_name: g.categories?.name || null,
      }));

      res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
    } else if (req.method === 'POST') {
      // 上传游戏 (multipart/form-data)
      const user = await requireAuth(req, res);
      if (!user) return;

      // 检查是否允许上传
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'allow_upload')
        .single();

      if (settings && settings.setting_value === 'false' && user.profile.role !== 'admin') {
        return res.status(403).json(error('暂不允许上传', 403));
      }

      // 解析 multipart form data
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // 简单解析 multipart boundary
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        return res.status(400).json(error('无效的请求格式'));
      }

      const boundary = boundaryMatch[1];
      const parts = parseMultipart(buffer, boundary);

      const titlePart = parts.find(p => p.name === 'title');
      const categoryPart = parts.find(p => p.name === 'category_id');
      const descPart = parts.find(p => p.name === 'description');
      const romPart = parts.find(p => p.name === 'rom');

      if (!titlePart || !titlePart.value) {
        return res.status(400).json(error('游戏名称不能为空'));
      }
      if (!romPart || !romPart.data) {
        return res.status(400).json(error('请选择 ROM 文件'));
      }

      const title = titlePart.value;
      const category_id = categoryPart?.value ? Number(categoryPart.value) : null;
      const description = descPart?.value || '';

      // 计算 MD5
      const md5 = crypto.createHash('md5').update(romPart.data).digest('hex');

      // 检查是否已存在
      const { data: existing } = await supabaseAdmin
        .from('games')
        .select('id, title')
        .eq('file_md5', md5)
        .single();

      if (existing) {
        return res.status(400).json(error(`该游戏已存在：${existing.title}`));
      }

      // 上传 ROM 到 Supabase Storage
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.nes`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('roms')
        .upload(fileName, romPart.data, {
          contentType: 'application/octet-stream',
        });

      if (uploadError) {
        console.error('ROM 上传错误:', uploadError);
        return res.status(500).json(error('文件上传失败', 500));
      }

      // 获取默认审核状态
      const { data: statusSetting } = await supabaseAdmin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'default_game_status')
        .single();

      const gameStatus = user.profile.role === 'admin'
        ? (statusSetting?.setting_value || 'approved')
        : 'pending';

      // 创建游戏记录
      const { data: game, error: createError } = await supabaseAdmin
        .from('games')
        .insert({
          title,
          category_id,
          description,
          rom_path: fileName,
          file_size: romPart.data.length,
          file_md5: md5,
          uploader_id: user.id,
          status: gameStatus,
        })
        .select()
        .single();

      if (createError) {
        console.error('创建游戏记录错误:', createError);
        return res.status(500).json(error('上传失败', 500));
      }

      res.status(200).json(success({ id: game.id }, '上传成功，等待审核'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('游戏 API 错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};

// 简单的 multipart 解析器
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBuf = Buffer.from(`--${boundary}--`);

  let pos = 0;
  const data = buffer;

  while (pos < data.length) {
    // 找到下一个 boundary
    const boundaryPos = data.indexOf(boundaryBuf, pos);
    if (boundaryPos === -1) break;

    // 找到 header 结束位置
    const headerEnd = data.indexOf('\r\n\r\n', boundaryPos);
    if (headerEnd === -1) break;

    const headerStr = data.slice(boundaryPos + boundaryBuf.length + 2, headerEnd).toString();

    // 找到下一个 boundary 作为内容结束
    const nextBoundary = data.indexOf(boundaryBuf, headerEnd + 4);
    if (nextBoundary === -1) break;

    // 内容 (去掉末尾的 \r\n)
    const content = data.slice(headerEnd + 4, nextBoundary - 2);

    // 解析 header
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      const part = {
        name: nameMatch[1],
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
      };

      if (filenameMatch) {
        part.data = content;
      } else {
        part.value = content.toString();
      }

      parts.push(part);
    }

    pos = nextBoundary;
  }

  return parts;
}
