create table player_sessions (
  id serial not null primary key,
  game_session_id int not null references game_sessions(id) on delete cascade,
  quiz_id int references quizzes(id) on delete cascade,
  player_id int references users(id) on delete cascade,
  player_guest_id varchar(255),
  player_name varchar(255) not null,
  player_score int not null default 0,
  answered_questions jsonb not null default '[]'::jsonb,
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

create index idx_player_sessions_game_session_id on player_sessions(game_session_id);
create index idx_player_sessions_player_id on player_sessions(player_id);