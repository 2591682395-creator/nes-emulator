const { supabaseAdmin } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/auth');
const { success, error, paginated } = require('../../lib/response');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      // 游戏列表
      const { page = 1, pageSize = 20, keyword, status, category_id } = req.query;
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const from = (pageNum - 1) * pageSizeNum;
      const to = from + pageSizeNum - 1;

      let query = supabaseAdmin
        .from('games')
        .select('*, categories(name)', { count: 'exact' });

      if (keyword) {
        query = query.ilike('title', `%${keyword}%`);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (category_id) {
        query = query.eq('category_id', Number(category_id));
      }

      const { data: games, count, error: queryError } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (queryError) {
        return res.status(500).json(error('获取游戏列表失败', 500));
      }

      const list = (games || []).map(g => ({
        ...g,
        category_name: g.categories?.name || null,
      }));

      res.status(200).json(paginated(list, count || 0, pageNum, pageSizeNum));
    } else if (req.method === 'POST') {
      // 管理员新增游戏
      // 解析 multipart form data
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);

      let title, category_id, description, gameStatus, romData, fileName;

      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = parseMultipart(buffer, boundary);

        const titlePart = parts.find(p => p.name === 'title');
        const categoryPart = parts.find(p => p.name === 'category_id');
        const descPart = parts.find(p => p.name === 'description');
        const statusPart = parts.find(p => p.name === 'status');
        const romPart = parts.find(p => p.name === 'rom');

        title = titlePart?.value;
        category_id = categoryPart?.value ? Number(categoryPart.value) : null;
        description = descPart?.value || '';
        gameStatus = statusPart?.value || 'approved';
        romData = romPart?.data;
      } else {
        // JSON body
        const body = JSON.parse(buffer.toString());
        title = body.title;
        category_id = body.category_id ? Number(body.category_id) : null;
        description = body.description || '';
        gameStatus = body.status || 'approved';
      }

      if (!title) {
        return res.status(400).json(error('游戏名称不能为空'));
      }

      let romPath = '';
      let fileSize = 0;
      let md5 = null;

      if (romData) {
        // 上传 ROM 到 Supabase Storage
        fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.nes`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('roms')
          .upload(fileName, romData, { contentType: 'application/octet-stream' });

        if (uploadError) {
          return res.status(500).json(error('文件上传失败', 500));
        }

        romPath = fileName;
        fileSize = romData.length;
        md5 = crypto.createHash('md5').update(romData).digest('hex');

        // 检查重复
        const { data: existing } = await supabaseAdmin
          .from('games')
          .select('id, title')
          .eq('file_md5', md5)
          .single();

        if (existing) {
          return res.status(400).json(error(`该游戏已存在：${existing.title}`));
        }
      }

      const { data: game, error: createError } = await supabaseAdmin
        .from('games')
        .insert({
          title,
          category_id,
          description,
          rom_path: romPath,
          file_size: fileSize,
          file_md5: md5,
          uploader_id: user.id,
          status: gameStatus || 'approved',
        })
        .select()
        .single();

      if (createError) {
        return res.status(500).json(error('新增游戏失败', 500));
      }

      await logAdmin(user.id, 'create_game', 'game', game.id, `新增游戏：${title}`, req);
      res.status(200).json(success({ id: game.id }, '新增成功'));
    } else {
      res.status(405).json(error('方法不允许', 405));
    }
  } catch (err) {
    console.error('游戏管理错误:', err);
    res.status(500).json(error('服务器错误', 500));
  }
};

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let pos = 0;

  while (pos < buffer.length) {
    const boundaryPos = buffer.indexOf(boundaryBuf, pos);
    if (boundaryPos === -1) break;

    const headerEnd = buffer.indexOf('\r\n\r\n', boundaryPos);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(boundaryPos + boundaryBuf.length + 2, headerEnd).toString();
    const nextBoundary = buffer.indexOf(boundaryBuf, headerEnd + 4);
    if (nextBoundary === -1) break;

    const content = buffer.slice(headerEnd + 4, nextBoundary - 2);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    if (nameMatch) {
      const part = { name: nameMatch[1] };
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

async function logAdmin(adminId, action, targetType, targetId, detail, req) {
  await supabaseAdmin.from('admin_logs').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
    ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
  });
}
