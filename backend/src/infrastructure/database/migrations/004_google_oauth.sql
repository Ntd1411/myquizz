-- Link Google account to users + support passwordless (OAuth-only) accounts
alter table users
  add column if not exists google_id varchar(255) unique,
  add column if not exists auth_provider varchar(50) not null default 'local'
    check (auth_provider in ('local', 'google'));

-- Google-only accounts have no local password
alter table users alter column password drop not null;

create index if not exists google_id_idx on users (google_id);