create table users (
  id serial not null primary key,
  username varchar(50) not null unique,
  fullname varchar(255) not null,
  email varchar(255) not null unique,
  phone varchar(255),
  password varchar(255) not null,
  is_active boolean not null default true,
  avatar varchar(255),
  description varchar(255),
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

create unique index user_idx on users (username);
create unique index email_idx on users (email);