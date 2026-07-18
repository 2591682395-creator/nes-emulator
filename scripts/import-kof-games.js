const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { qiniuPath, qiniuUrl } = require('../lib/rom-storage');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const sourceDir = path.resolve(__dirname, '..', '..', '..', 'nes', '拳皇');
const supported = new Set(['.gba', '.gbc', '.gb', '.sfc', '.smc', '.nes']);

function titleFor(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/^\d+[-_]/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function metadataFor(filename) {
  const extension = path.extname(filename).toLowerCase();
  const title = titleFor(filename);
  const region = ({ '.nes': 'NES', '.sfc': 'SFC', '.smc': 'SFC', '.gb': 'GB', '.gbc': 'GBC', '.gba': 'GBA' })[extension];
  let categoryId = 5;
  let categoryName = '格斗';
  if (/最终幻想|女神转生/.test(title)) {
    categoryId = 9;
    categoryName = '角色扮演';
  } else if (/合金弹头|古墓丽影/.test(title)) {
    categoryId = 1;
    categoryName = '动作';
  } else if (/頭文字D|头文字D/.test(title)) {
    categoryId = 8;
    categoryName = '赛车';
  }
  return {
    title,
    region,
    category_id: categoryId,
    description: `${region} ${categoryName}游戏，来自拳皇游戏包`,
  };
}

function headStatus(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'HEAD' }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects > 0) {
        response.resume();
        headStatus(new URL(response.headers.location, url), redirects - 1).then(resolve, reject);
        return;
      }
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.setTimeout(30000, () => request.destroy(new Error('七牛文件检查超时')));
    request.on('error', reject);
    request.end();
  });
}

async function main() {
  if (!process.env.QINIU_BASE_URL) throw new Error('缺少 QINIU_BASE_URL（七牛绑定域名）');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('缺少 Supabase 服务端配置');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: admin, error: adminError } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle();
  if (adminError || !admin) throw adminError || new Error('Supabase 中没有管理员账号，无法设置 uploader_id');

  const files = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && supported.has(path.extname(entry.name).toLowerCase()))
    .map(entry => entry.name);
  if (!files.length) throw new Error(`没有在 ${sourceDir} 找到支持的 ROM`);

  let uploaded = 0;
  let updated = 0;
  let skipped = 0;
  for (const filename of files) {
    const fullPath = path.join(sourceDir, filename);
    const data = fs.readFileSync(fullPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    const storagePath = qiniuPath(`game/${filename}`);
    const metadata = metadataFor(filename);
    const { data: existing, error: lookupError } = await supabase
      .from('games')
      .select('id,title,rom_path,category_id,description,region,file_size')
      .eq('file_md5', md5)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      const needsUpdate = existing.rom_path !== storagePath
        || existing.title !== metadata.title
        || existing.category_id !== metadata.category_id
        || existing.description !== metadata.description
        || existing.region !== metadata.region
        || existing.file_size !== data.length;
      if (needsUpdate) {
        const { error: updateError } = await supabase.from('games').update({
          ...metadata,
          rom_path: storagePath,
          file_size: data.length,
        }).eq('id', existing.id);
        if (updateError) throw updateError;
        console.log(`更新七牛地址：${filename} (#${existing.id})`);
        updated++;
        continue;
      }
      console.log(`跳过已存在：${filename} (#${existing.id})`);
      skipped++;
      continue;
    }

    const remoteUrl = qiniuUrl(storagePath);
    console.log(`检查七牛文件：${remoteUrl}`);
    const status = await headStatus(remoteUrl);
    if (status < 200 || status >= 300) throw new Error(`七牛文件不存在或不可访问：${filename} (${status})`);
    console.log(`注册：${filename}`);
    const { error: insertError } = await supabase.from('games').insert({
      ...metadata,
      rom_path: storagePath,
      file_size: data.length,
      file_md5: md5,
      uploader_id: admin.id,
      status: 'approved',
    });
    if (insertError) throw insertError;
    uploaded++;
  }
  console.log(`导入完成：新增 ${uploaded}，更新 ${updated}，跳过 ${skipped}，共 ${files.length}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
