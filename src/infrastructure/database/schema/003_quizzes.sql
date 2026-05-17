create table quizzes (
  id serial not null primary key,
  quiz_owner int not null references users(id) on delete cascade,
  quiz_name varchar(255) not null,
  quiz_description varchar(255),
  quiz_language varchar(50) not null,
  quiz_image varchar(255),
  quiz_category int references quiz_categories(id),
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

create index quiz_owner_idx on quizzes (quiz_owner);