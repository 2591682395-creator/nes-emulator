-- 在 Supabase SQL Editor 中执行一次。
CREATE TABLE IF NOT EXISTS game_saves (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  rom_hash VARCHAR(64) NOT NULL,
  core VARCHAR(20) NOT NULL,
  save_type VARCHAR(20) NOT NULL CHECK (save_type IN ('sram', 'state')),
  slot VARCHAR(24) NOT NULL DEFAULT 'auto',
  storage_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  checksum VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, rom_hash, slot)
);
CREATE INDEX IF NOT EXISTS idx_game_saves_user_game ON game_saves(user_id, game_id);
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_saves_select" ON game_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "game_saves_insert" ON game_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_saves_update" ON game_saves FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "game_saves_delete" ON game_saves FOR DELETE USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('saves', 'saves', false, 15728640)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 15728640;

CREATE POLICY "save_files_select" ON storage.objects FOR SELECT
USING (bucket_id = 'saves' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "save_files_insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'saves' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "save_files_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'saves' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "save_files_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'saves' AND (storage.foldername(name))[1] = auth.uid()::text);
