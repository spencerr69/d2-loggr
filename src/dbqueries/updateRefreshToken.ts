export default async function updateRefreshToken(db: D1Database, membershipId: number, refreshToken: string, refreshExpiry: number) {
	const { results } = await db
		.prepare(
			"INSERT INTO Tokens (membership_id, refresh_token, refresh_expiry, received_date) VALUES (?, ?, ?, date('now')) ON CONFLICT(membership_id) DO UPDATE SET refresh_token = ?, refresh_expiry = ?, received_date = date('now');",
		)
		.bind(membershipId, refreshToken, refreshExpiry, refreshToken, refreshExpiry)
		.run();

	return Response.json(results);
}
