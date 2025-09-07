
DROP TABLE IF EXISTS Tokens;
CREATE TABLE Tokens (
	membership_id INTEGER PRIMARY KEY,
	refresh_token TEXT,
	refresh_expiry INTEGER,
	received_date TEXT
);

DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
	membership_id INTEGER PRIMARY KEY,
	bungie_display_name TEXT,
	bungie_display_name_code INTEGER
);
