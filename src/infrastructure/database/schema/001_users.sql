create table users (
  id serial not null primary key,
  fullname varchar(255) not null,
  email varchar(255) not null unique,
  phone varchar(255) unique,
  password varchar(255) not null,
  role varchar(50) not null default 'user' check(role in ('admin', 'moderator', 'user')),
  is_active boolean not null default true,
  avatar varchar(255),
  description varchar(255),
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);
