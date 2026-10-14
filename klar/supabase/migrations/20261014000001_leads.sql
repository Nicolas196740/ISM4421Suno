-- KLAR Construction lead capture.
-- Visitors (anon) can only INSERT a new lead; they can never read, edit or delete one.
-- Only users listed in public.admins can read and update leads (status, notes).

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.admins is 'Auth users allowed into the KLAR admin dashboard.';
alter table public.admins enable row level security;

-- Security definer so policies can check admin membership without exposing the admins table.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can see the admin list"
  on public.admins for select to authenticated
  using ((select public.is_admin()));

create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Shared fields
  lead_type          text not null check (lead_type in ('buyer', 'investor', 'land_owner', 'other')),
  full_name          text not null check (char_length(full_name) between 2 and 120),
  email              text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone              text not null check (char_length(phone) between 7 and 30),
  preferred_contact  text not null check (preferred_contact in ('email', 'phone', 'text')),
  message            text check (char_length(message) <= 3000),
  heard_about        text check (char_length(heard_about) <= 120),
  consent_contact    boolean not null check (consent_contact),
  consent_sms        boolean not null default false,
  source_page        text check (char_length(source_page) <= 60),

  -- Buyer
  budget_range       text check (char_length(budget_range) <= 60),
  desired_area       text check (char_length(desired_area) <= 120),
  timeline           text check (char_length(timeline) <= 60),
  pre_approved       boolean,

  -- Investor
  investment_range   text check (char_length(investment_range) <= 60),
  investor_interest  text check (investor_interest in ('buy_completed', 'invest_in_project', 'both')),
  experience_level   text check (char_length(experience_level) <= 60),

  -- Land owner
  property_address   text check (char_length(property_address) <= 250),
  lot_size           text check (char_length(lot_size) <= 60),
  current_zoning     text check (char_length(current_zoning) <= 60),
  asking_price       text check (char_length(asking_price) <= 60),
  owner_or_agent     text check (owner_or_agent in ('owner', 'agent')),

  -- Admin only
  status             text not null default 'New'
                     check (status in ('New', 'Contacted', 'Qualified', 'Not a fit', 'Closed')),
  notes              text check (char_length(notes) <= 10000)
);
comment on table public.leads is 'Website inquiries from buyers, investors and land owners.';

create index leads_created_at_idx on public.leads (created_at desc);
create index leads_type_status_idx on public.leads (lead_type, status);

alter table public.leads enable row level security;

-- Website forms: insert only, and only as a fresh lead (no pre-set status or notes).
create policy "Visitors can submit a lead"
  on public.leads for insert to anon, authenticated
  with check (status = 'New' and notes is null);

create policy "Admins can read leads"
  on public.leads for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can update leads"
  on public.leads for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Visitors only need INSERT; admins only change status and notes.
revoke all on public.leads from anon, authenticated;
-- Column-level grant: visitors can't set id, timestamps, status or notes.
grant insert (lead_type, full_name, email, phone, preferred_contact, message, heard_about,
              consent_contact, consent_sms, source_page,
              budget_range, desired_area, timeline, pre_approved,
              investment_range, investor_interest, experience_level,
              property_address, lot_size, current_zoning, asking_price, owner_or_agent)
  on public.leads to anon, authenticated;
grant select on public.leads to authenticated;
grant update (status, notes) on public.leads to authenticated;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();
