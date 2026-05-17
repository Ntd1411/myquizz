create table quiz_categories (
  id serial not null primary key,
  category_name varchar(100) not null unique,
  description varchar(255),
  icon varchar(255),
  created_at timestamp with time zone default current_timestamp
);