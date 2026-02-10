-- ============================================================================
-- 1. PROFILES TABLE (Public User Data)
-- ============================================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  avatar_url text,
  credits integer default 100,
  last_reset_date date default current_date,
  updated_at timestamp with time zone,
  
  constraint username_length check (char_length(username) >= 3)
);

-- Function to handle daily credit reset
create or replace function public.check_and_reset_daily_credits(p_user_id uuid)
returns integer as $$
declare
    current_credits integer;
    last_reset date;
begin
    select credits, last_reset_date into current_credits, last_reset
    from public.profiles
    where id = p_user_id;

    if last_reset is null or last_reset < current_date then
        update public.profiles
        set credits = 100,
            last_reset_date = current_date
        where id = p_user_id;
        return 100;
    end if;

    return current_credits;
end;
$$ language plpgsql security definer;

-- Function to deduct credits atomically
create or replace function public.deduct_user_credits(p_user_id uuid, p_amount integer)
returns integer as $$
declare
    new_credits integer;
begin
    update public.profiles
    set credits = credits - p_amount
    where id = p_user_id and credits >= p_amount
    returning credits into new_credits;

    if not found then
        raise exception 'Insufficient credits';
    end if;

    return new_credits;
end;
$$ language plpgsql security definer;

-- Turn on RLS
alter table profiles enable row level security;

-- Policies (Idempotent)
do $$ 
begin
  if not exists (select 1 from pg_policies where policyname = 'Public profiles are viewable by everyone.' and tablename = 'profiles') then
    create policy "Public profiles are viewable by everyone." on profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert their own profile.' and tablename = 'profiles') then
    create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update own profile.' and tablename = 'profiles') then
    create policy "Users can update own profile." on profiles for update using (auth.uid() = id);
  end if;
end $$;

-- ============================================================================
-- 2. WALLPAPERS TABLE (Core Data)
-- ============================================================================
create table if not exists wallpapers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  url text not null,
  prompt text,
  genre text,
  style text,
  seed numeric, -- Use numeric for large seeds
  width int,
  height int,
  is_public boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS
alter table wallpapers enable row level security;

-- Policies (Idempotent)
do $$ 
begin
  if not exists (select 1 from pg_policies where policyname = 'Wallpapers are viewable by everyone if public.' and tablename = 'wallpapers') then
    create policy "Wallpapers are viewable by everyone if public." on wallpapers for select using (is_public = true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can see their own wallpapers.' and tablename = 'wallpapers') then
    create policy "Users can see their own wallpapers." on wallpapers for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert their own wallpapers.' and tablename = 'wallpapers') then
    create policy "Users can insert their own wallpapers." on wallpapers for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update their own wallpapers.' and tablename = 'wallpapers') then
    create policy "Users can update their own wallpapers." on wallpapers for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can delete their own wallpapers.' and tablename = 'wallpapers') then
    create policy "Users can delete their own wallpapers." on wallpapers for delete using (auth.uid() = user_id);
  end if;
end $$;


-- ============================================================================
-- 3. TRIGGERS (Auto-create profile on signup)
-- ============================================================================
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- Likes Table
create table if not exists public.likes (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    wallpaper_id uuid references public.wallpapers(id) on delete cascade,
    created_at timestamptz default now(),
    unique(user_id, wallpaper_id)
);

-- Enable RLS
alter table public.likes enable row level security;

-- RLS Policies (Idempotent)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Public likes are viewable by everyone' and tablename = 'likes') then
    create policy "Public likes are viewable by everyone" on public.likes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can like/unlike wallpapers' and tablename = 'likes') then
    create policy "Users can like/unlike wallpapers" on public.likes for all using (auth.uid() = user_id);
  end if;
end $$;

-- Indexes for performance
create index if not exists likes_wallpaper_id_idx on public.likes(wallpaper_id);
create index if not exists likes_user_id_idx on public.likes(user_id);

-- ============================================================================
-- 5. FOLLOWS TABLE (Social Relationships)
-- ============================================================================
create table if not exists public.follows (
    id uuid default gen_random_uuid() primary key,
    follower_id uuid references auth.users(id) on delete cascade not null,
    following_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamptz default now(),
    unique(follower_id, following_id),
    constraint no_self_follow check (follower_id <> following_id)
);

-- Enable RLS
alter table public.follows enable row level security;

-- RLS Policies (Idempotent)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Public follows are viewable by everyone' and tablename = 'follows') then
    create policy "Public follows are viewable by everyone" on public.follows for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can follow others' and tablename = 'follows') then
    create policy "Users can follow others" on public.follows for insert with check (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can unfollow others' and tablename = 'follows') then
    create policy "Users can unfollow others" on public.follows for delete using (auth.uid() = follower_id);
  end if;
end $$;

-- Indexes for performance
create index if not exists follows_follower_id_idx on public.follows(follower_id);
create index if not exists follows_following_id_idx on public.follows(following_id);

-- ============================================================================
-- 4. STORAGE (Avatars)
-- ============================================================================

-- Create a bucket for avatars (Note: bucket creation often requires superuser/special permissions, 
-- but this SQL works in many Supabase environments if run from the dashboard)
insert into storage.buckets (id, name, public)
select 'avatars', 'avatars', true
where not exists (
    select 1 from storage.buckets where id = 'avatars'
);

-- Storage Policies (Idempotent)
do $$
begin
  -- Public Read Access
  if not exists (select 1 from pg_policies where policyname = 'Avatar images are publicly accessible.' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Avatar images are publicly accessible." on storage.objects for select using (bucket_id = 'avatars');
  end if;

  -- Authenticated Upload Access
  if not exists (select 1 from pg_policies where policyname = 'Users can upload their own avatars.' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Users can upload their own avatars." on storage.objects for insert with check (
      bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]
    );
  end if;

  -- Authenticated Update/Delete Access
  if not exists (select 1 from pg_policies where policyname = 'Users can manage their own avatars.' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Users can manage their own avatars." on storage.objects for update using (
      bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]
    );
    create policy "Users can delete their own avatars." on storage.objects for delete using (
      bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]
    );
  end if;
end $$;
