-- 010_widen_player_avatar.sql
-- 009 stored the guest avatar as varchar(255), but the socket layer accepts any
-- storage URL a client sends (see game.schema.ts), and a signed or CDN URL with a
-- long query string routinely exceeds 255 characters. Widening to text avoids a
-- silent truncation turning into a broken image for the rest of the match.

alter table player_sessions
alter column player_avatar type text;
