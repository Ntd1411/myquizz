create table questions (
  id serial not null primary key,
  quiz_id int not null references quizzes(id) on delete cascade,
  question_type varchar(50) not null check (question_type in ('multiple_choice', 'multiple_select', 'short_answer', 'long_answer')),
  question_text varchar(255) not null,
  question_image varchar(255),
  answer_options jsonb,
  correct_answer jsonb not null,
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

create index quiz_id_idx on questions (quiz_id);