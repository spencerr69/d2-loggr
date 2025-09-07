
DROP TABLE IF EXISTS Tokens;
CREATE TABLE Tokens (
	membership_id INTEGER PRIMARY KEY,
	refresh_token TEXT,
	refresh_expiry TEXT,
	received_date TEXT
);
INSERT INTO Tokens (membership_id, refresh_token, refresh_expiry, received_date) Values (0, "test", "test", date("now"));
