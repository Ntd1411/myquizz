create table refresh_sessions (
  id serial not null primary key,
  user_id int not null references users(id) on delete cascade,
  device_name varchar(255) not null,
  ip_address varchar(255) not null,
  refresh_token varchar(255) not null unique,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default current_timestamp
);

create index user_id_idx on refresh_sessions (user_id);
create index refresh_token_idx on refresh_sessions (refresh_token);