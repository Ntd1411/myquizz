create table blacklist_token (
  id serial not null primary key,
  token text not null unique,
  created_at timestamp with time zone default current_timestamp
);