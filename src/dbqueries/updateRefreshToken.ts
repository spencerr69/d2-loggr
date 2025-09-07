export default async function updateRefreshToken(env: Env, membershipId: string, refreshToken: string, refreshExpiry: number) {
	const { results } = await env.loggr_db
		.prepare("UPDATE Tokens SET refresh_token = ?, refresh_expiry = ?, received_date = date('now') WHERE membership_id = ?")
		.bind(refreshToken, refreshExpiry, membershipId)
		.run();

	return Response.json(results);
}
