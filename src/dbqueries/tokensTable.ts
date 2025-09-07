export async function updateTokenRecord(db: D1Database, membershipId: string, refreshToken: string, refreshExpiry: number) {
	const { results } = await db
		.prepare(
			"INSERT INTO Tokens (membership_id, refresh_token, refresh_expiry, received_date) VALUES (?, ?, ?, date('now')) ON CONFLICT(membership_id) DO UPDATE SET refresh_token = ?, refresh_expiry = ?, received_date = date('now');",
		)
		.bind(parseInt(membershipId), refreshToken, refreshExpiry, refreshToken, refreshExpiry)
		.run();

	return Response.json(results);
}

export async function getRefreshTokens(db: D1Database) {
	const { results } = await db.prepare('SELECT * FROM Tokens').run();
	return results;
}
