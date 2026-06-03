create table game_sessions (
  id serial not null primary key,
  quiz_snapshot_id int not null references quiz_snapshots(id) on delete cascade,
  session_name varchar(255) not null,
  session_code varchar(10) not null unique,
  session_host int not null references users(id) on delete cascade,
  total_players int not null default 0,
  total_questions int not null default 0,
  session_status varchar(50) not null check (session_status in ('waiting', 'active', 'finished')),
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

create index game_session_snapshot_id_idx on game_sessions (quiz_snapshot_id);
create index game_session_host_idx on game_sessions (session_host);
