-- Wordtock ─ Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。
-- 既存環境にも安全に流せるよう、すべて idempotent に書いています。

-- フォルダ（学習の束）
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now()
);

create index if not exists folders_user_idx on public.folders (user_id, created_at desc);

alter table public.folders enable row level security;

drop policy if exists "Users can view own folders" on public.folders;
create policy "Users can view own folders" on public.folders
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own folders" on public.folders;
create policy "Users can insert own folders" on public.folders
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own folders" on public.folders;
create policy "Users can update own folders" on public.folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own folders" on public.folders;
create policy "Users can delete own folders" on public.folders
  for delete using (auth.uid() = user_id);

-- 単語/イディオム + フォルダ + 学習データ
create table if not exists public.words (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id            uuid references public.folders (id) on delete set null,
  kind                 text not null default 'word' check (kind in ('word', 'idiom')),
  term                 text not null,
  language             text not null check (language in ('en', 'ko')),
  reading              text,
  part_of_speech       text,
  meaning              text not null,
  example              text,
  example_translation  text,
  notes                text,
  -- SRS (SM-2) 用カラム
  srs_reps             integer not null default 0,
  srs_interval         integer not null default 0,
  srs_ease             numeric not null default 2.5,
  srs_lapses           integer not null default 0,
  srs_due              timestamptz not null default now(),
  last_reviewed        timestamptz,
  -- 累積の学習データ（SM-2 がリセットされても消えない総回数）
  total_reviews        integer not null default 0,
  correct_reviews      integer not null default 0,
  created_at           timestamptz not null default now()
);

-- 既存テーブルにも上記カラムを足す（初回作成時は no-op）
alter table public.words add column if not exists folder_id uuid references public.folders (id) on delete set null;
alter table public.words add column if not exists kind text not null default 'word';
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='words' and constraint_name='words_kind_check'
  ) then
    alter table public.words add constraint words_kind_check check (kind in ('word','idiom'));
  end if;
end$$;
alter table public.words add column if not exists total_reviews integer not null default 0;
alter table public.words add column if not exists correct_reviews integer not null default 0;

create index if not exists words_user_due_idx on public.words (user_id, srs_due);
create index if not exists words_user_created_idx on public.words (user_id, created_at desc);
create index if not exists words_user_folder_idx on public.words (user_id, folder_id);
create index if not exists words_user_kind_idx on public.words (user_id, kind);

alter table public.words enable row level security;

drop policy if exists "Users can view own words" on public.words;
create policy "Users can view own words" on public.words
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own words" on public.words;
create policy "Users can insert own words" on public.words
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own words" on public.words;
create policy "Users can update own words" on public.words
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own words" on public.words;
create policy "Users can delete own words" on public.words
  for delete using (auth.uid() = user_id);
