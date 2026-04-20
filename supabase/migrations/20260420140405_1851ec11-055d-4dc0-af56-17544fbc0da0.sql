-- Fix function search_path warnings
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

-- Restrict storage listing: only allow reads on files in folders matching ticket access
drop policy if exists "Anyone authenticated can read ticket attachments" on storage.objects;

create policy "Read ticket attachments for accessible tickets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff(auth.uid())
    )
  );