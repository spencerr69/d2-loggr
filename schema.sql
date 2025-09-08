
DROP TABLE IF EXISTS Tokens;
CREATE TABLE Tokens (
	membership_id TEXT PRIMARY KEY,
	refresh_token TEXT,
	refresh_expiry INTEGER,
	received_date TEXT
);

DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
	membership_id TEXT PRIMARY KEY,
	bungie_display_name TEXT,
	bungie_display_name_code INTEGER
);

DROP TABLE IF EXISTS Lightlog;
CREATE TABLE Lightlog (
	log_id INTEGER PRIMARY KEY,
	membership_id TEXT,
	max_light_level REAL,
	total_time_played INTEGER,
	date TEXT
);
