create table quiz_snapshots (
  id serial not null primary key,
  quiz_id int not null references quizzes(id) on delete cascade,
  snapshot_data jsonb not null,
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

create index quiz_snapshot_quiz_id_idx on quiz_snapshots (quiz_id);
