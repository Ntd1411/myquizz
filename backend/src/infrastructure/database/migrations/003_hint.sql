-- add question hint and explanation column
alter table questions add column question_hint varchar(255);
alter table questions add column explanation varchar(255);