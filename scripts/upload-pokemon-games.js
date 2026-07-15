const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..', '..');

function loadEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim();
  }
  return values;
}

const env = loadEnv(path.join(projectRoot, '.env'));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const games = [
  {
    title: '宝可梦最强进化3.0',
    folder: '04_宝可梦最强进化3.0',
    rom: '宝可梦最强进化3.0.gba',
    cover: '宝可梦最强进化3.0.webp',
    description: '宝可梦最强进化 V3.0 最终版，GBA 角色扮演游戏。',
  },
  {
    title: '宝可梦漆黑的魅影5.0',
    folder: '05_宝可梦漆黑的魅影5.0',
    rom: '宝可梦漆黑的魅影5.0.gba',
    cover: '宝可梦漆黑的魅影5.0.webp',
    description: '宝可梦漆黑的魅影 5.0EX 无尽混沌版，GBA 角色扮演游戏。',
  },
  {
    title: '宝可梦漆黑的魅影1.5',
    folder: '06_宝可梦漆黑的魅影1.5',
    rom: '宝可梦漆黑的魅影1.5.gba',
    cover: '宝可梦漆黑的魅影1.5.webp',
    description: '宝可梦漆黑的魅影 1.5 版，GBA 角色扮演游戏。',
  },
];

async function uploadGame(game, index) {
  const directory = path.join(workspaceRoot, 'nes', game.folder);
  const romBuffer = fs.readFileSync(path.join(directory, game.rom));
  const coverBuffer = fs.readFileSync(path.join(directory, game.cover));
  const md5 = crypto.createHash('md5').update(romBuffer).digest('hex');

  const { data: existing, error: existingError } = await supabase
    .from('games')
    .select('id,title')
    .eq('file_md5', md5)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const refreshedCoverPath = `pokemon-cover-${Date.now()}-${index}.webp`;
    const { error: refreshedCoverError } = await supabase.storage
      .from('covers')
      .upload(refreshedCoverPath, coverBuffer, { contentType: 'image/webp', upsert: false });
    if (refreshedCoverError) throw refreshedCoverError;
    const { data: refreshedCover } = supabase.storage.from('covers').getPublicUrl(refreshedCoverPath);
    const { error: refreshError } = await supabase
      .from('games')
      .update({
        title: game.title,
        category_id: 9,
        description: game.description,
        cover_path: refreshedCover.publicUrl,
        region: 'GBA',
        status: 'approved',
      })
      .eq('id', existing.id);
    if (refreshError) {
      await supabase.storage.from('covers').remove([refreshedCoverPath]);
      throw refreshError;
    }
    console.log(`更新已存在的游戏：${existing.title} (#${existing.id})`);
    return existing.id;
  }

  const stamp = Date.now() + index;
  const romPath = `pokemon-${stamp}.gba`;
  const coverPath = `pokemon-cover-${stamp}.webp`;

  const { error: romError } = await supabase.storage
    .from('roms')
    .upload(romPath, romBuffer, { contentType: 'application/octet-stream', upsert: false });
  if (romError) throw romError;

  const { error: coverError } = await supabase.storage
    .from('covers')
    .upload(coverPath, coverBuffer, { contentType: 'image/webp', upsert: false });
  if (coverError) {
    await supabase.storage.from('roms').remove([romPath]);
    throw coverError;
  }

  const { data: publicCover } = supabase.storage.from('covers').getPublicUrl(coverPath);
  const { data: created, error: createError } = await supabase
    .from('games')
    .insert({
      title: game.title,
      category_id: 9,
      description: game.description,
      rom_path: romPath,
      cover_path: publicCover.publicUrl,
      file_size: romBuffer.length,
      file_md5: md5,
      region: 'GBA',
      status: 'approved',
    })
    .select('id')
    .single();

  if (createError) {
    await Promise.all([
      supabase.storage.from('roms').remove([romPath]),
      supabase.storage.from('covers').remove([coverPath]),
    ]);
    throw createError;
  }

  console.log(`上传完成：${game.title} (#${created.id})`);
  return created.id;
}

async function main() {
  for (let index = 0; index < games.length; index += 1) {
    await uploadGame(games[index], index);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
