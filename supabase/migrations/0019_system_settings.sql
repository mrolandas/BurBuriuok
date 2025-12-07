-- 0019_system_settings.sql
-- Creates a table for global system configuration.

create table if not exists burburiuok.system_settings (
    key text primary key,
    value jsonb not null,
    description text,
    updated_at timestamptz not null default timezone('utc', now()),
    updated_by uuid references auth.users (id)
);

-- Insert default settings
insert into burburiuok.system_settings (key, value, description)
values ('registration_enabled', 'true'::jsonb, 'Controls whether new users can sign up via magic link.')
on conflict (key) do nothing;

-- Enable RLS
alter table burburiuok.system_settings enable row level security;

-- Policies
-- Admins can read and update settings
create policy "Admins can manage system settings"
    on burburiuok.system_settings
    for all
    using (
        exists (
            select 1 from auth.users
            where auth.users.id = auth.uid()
            and (auth.users.raw_app_meta_data->>'app_role')::text = 'admin'
        )
    );

-- Service role (backend) can read settings
create policy "Service role can read system settings"
    on burburiuok.system_settings
    for select
    using (true); -- Service role bypasses RLS anyway, but good to be explicit if we use a restricted client
