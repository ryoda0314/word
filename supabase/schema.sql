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
  -- SRS 用カラム（エビングハウス曲線ベースのフェーズ制スケジューラ）
  srs_reps             integer not null default 0,
  srs_interval         integer not null default 0,
  srs_ease             numeric not null default 2.5,
  srs_lapses           integer not null default 0,
  srs_phase            text not null default 'learning' check (srs_phase in ('learning', 'review', 'relearning')),
  srs_step             integer not null default 0,
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

-- SRS v2: フェーズ制スケジューラ用カラム（初回追加時のみ既存データを移行する）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='words' and column_name='srs_phase'
  ) then
    alter table public.words add column srs_phase text not null default 'learning'
      check (srs_phase in ('learning', 'review', 'relearning'));
    alter table public.words add column srs_step integer not null default 0;
    -- 旧 SM-2 データの移行: 間隔が 1 日以上ついている単語は復習フェーズとみなす
    update public.words set srs_phase = 'review' where srs_interval >= 1;
  end if;
end$$;

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

-- 復習ログ（1 回の採点 = 1 行）
-- 学習ヒートマップ・定着率の計算に使う。単語を削除しても履歴は残す（word_id は null になる）
create table if not exists public.review_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id          uuid references public.words (id) on delete set null,
  grade            text not null check (grade in ('again', 'hard', 'good', 'easy')),
  phase            text not null default 'review',  -- 採点時点のフェーズ
  was_new          boolean not null default false,  -- この採点が初学習（新規カードの導入）だったか
  interval_before  integer not null default 0,
  interval_after   integer not null default 0,
  ease_after       numeric not null default 2.5,
  reviewed_at      timestamptz not null default now()
);

-- 既存テーブルにも上記カラムを足す（初回作成時は no-op）
alter table public.review_logs add column if not exists was_new boolean not null default false;

create index if not exists review_logs_user_time_idx on public.review_logs (user_id, reviewed_at desc);

alter table public.review_logs enable row level security;

drop policy if exists "Users can view own review logs" on public.review_logs;
create policy "Users can view own review logs" on public.review_logs
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own review logs" on public.review_logs;
create policy "Users can insert own review logs" on public.review_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own review logs" on public.review_logs;
create policy "Users can delete own review logs" on public.review_logs
  for delete using (auth.uid() = user_id);

-- 実践文の保存（後から見返せるように、単語辞書ごとスナップショットで持つ）
create table if not exists public.practice_passages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id    uuid references public.folders (id) on delete set null,
  folder_name  text,            -- スナップショット（フォルダ削除や改名後も表示できる）
  language     text not null check (language in ('en', 'ko')),
  passage      text not null,   -- <w id="..."> タグ込みの本文
  translation  text not null,
  used_ids     jsonb not null default '[]'::jsonb,
  -- 生成時に使った単語辞書 {id: {term, meaning}}。元の単語が消えても表示できる
  words        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists practice_user_idx on public.practice_passages (user_id, created_at desc);
create index if not exists practice_folder_idx on public.practice_passages (user_id, folder_id);

alter table public.practice_passages enable row level security;

drop policy if exists "Users can view own practice" on public.practice_passages;
create policy "Users can view own practice" on public.practice_passages
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own practice" on public.practice_passages;
create policy "Users can insert own practice" on public.practice_passages
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own practice" on public.practice_passages;
create policy "Users can delete own practice" on public.practice_passages
  for delete using (auth.uid() = user_id);

-- メモ帳（あとで ChatGPT に投げるための下書きなど、自由記述のメモ）
create table if not exists public.memos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists memos_user_idx on public.memos (user_id, updated_at desc);

alter table public.memos enable row level security;

drop policy if exists "Users can view own memos" on public.memos;
create policy "Users can view own memos" on public.memos
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own memos" on public.memos;
create policy "Users can insert own memos" on public.memos
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own memos" on public.memos;
create policy "Users can update own memos" on public.memos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own memos" on public.memos;
create policy "Users can delete own memos" on public.memos
  for delete using (auth.uid() = user_id);
