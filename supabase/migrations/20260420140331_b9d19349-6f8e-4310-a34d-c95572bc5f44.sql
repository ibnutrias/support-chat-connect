-- Role enum
create type public.app_role as enum ('admin', 'support', 'user');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- User roles table (separate from profiles for security)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer function to check roles (avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Helper: is_staff (support OR admin)
create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('support','admin')
  )
$$;

-- Ticket status enum
create type public.ticket_status as enum ('open', 'pending', 'closed');
create type public.sentiment_label as enum ('positive', 'neutral', 'negative');

-- Tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  description text,
  status ticket_status not null default 'open',
  user_id uuid references auth.users(id) on delete cascade not null,
  assigned_to uuid references auth.users(id) on delete set null,
  sentiment sentiment_label,
  sentiment_score numeric,
  sentiment_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.tickets enable row level security;
create index tickets_user_id_idx on public.tickets(user_id);
create index tickets_status_idx on public.tickets(status);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete set null,
  body text,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
create index messages_ticket_id_idx on public.messages(ticket_id);

-- Auto profile creation on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  -- default role: user
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger tickets_touch before update on public.tickets
  for each row execute procedure public.touch_updated_at();

-- ===== RLS POLICIES =====

-- Profiles: anyone authenticated can read; user can update own; staff can read all (already covered)
create policy "Profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- User roles: users see own roles; admins manage all
create policy "Users view own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all roles"
  on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins insert roles"
  on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "Admins update roles"
  on public.user_roles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins delete roles"
  on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- Tickets: users see own; staff see all
create policy "Users view own tickets"
  on public.tickets for select to authenticated using (auth.uid() = user_id);
create policy "Staff view all tickets"
  on public.tickets for select to authenticated using (public.is_staff(auth.uid()));
create policy "Users create own tickets"
  on public.tickets for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own open tickets"
  on public.tickets for update to authenticated using (auth.uid() = user_id);
create policy "Staff update any ticket"
  on public.tickets for update to authenticated using (public.is_staff(auth.uid()));

-- Messages: visible to ticket participants and staff
create policy "View messages on own tickets"
  on public.messages for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_staff(auth.uid()))));
create policy "Insert messages on accessible tickets"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid() and
    exists (select 1 from public.tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_staff(auth.uid())))
  );

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.tickets;
alter table public.messages replica identity full;
alter table public.tickets replica identity full;

-- Storage bucket for chat attachments
insert into storage.buckets (id, name, public) values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

create policy "Anyone authenticated can read ticket attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments');
create policy "Authenticated can upload ticket attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-attachments' and (storage.foldername(name))[1] = auth.uid()::text);