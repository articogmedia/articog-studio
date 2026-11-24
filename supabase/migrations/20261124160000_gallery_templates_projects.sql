create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.articog_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  model text not null,
  type text not null check (type in ('image', 'video')),
  prompt text not null default '',
  input jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '[]'::jsonb,
  favorite boolean not null default false,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists articog_history_prompt_fts_idx
  on public.articog_history using gin (to_tsvector('english', coalesce(prompt, '')));
create index if not exists articog_history_user_created_idx
  on public.articog_history (user_id, created_at desc);
create index if not exists projects_user_created_idx
  on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;
alter table public.articog_history enable row level security;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.articog_history to authenticated;

create policy "Users can read their own projects"
  on public.projects for select using (auth.uid() = user_id);
create policy "Users can create their own projects"
  on public.projects for insert with check (auth.uid() = user_id);
create policy "Users can update their own projects"
  on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own projects"
  on public.projects for delete using (auth.uid() = user_id);

create policy "Users can read their own history"
  on public.articog_history for select using (auth.uid() = user_id);
create policy "Users can create their own history"
  on public.articog_history for insert with check (auth.uid() = user_id);
create policy "Users can update their own history"
  on public.articog_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own history"
  on public.articog_history for delete using (auth.uid() = user_id);
