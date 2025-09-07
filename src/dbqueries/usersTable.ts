export async function updateUserRecord(
	db: D1Database,
	membershipId: string,
	bungieDisplayName: string | undefined,
	bungieDisplayNameCode: number | undefined,
) {
	const { results } = await db
		.prepare(
			'INSERT INTO Users (membership_id, bungie_display_name, bungie_display_name_code) VALUES (?, ?, ?) ON CONFLICT(membership_id) DO UPDATE SET bungie_display_name = ?, bungie_display_name_code = ?;',
		)
		.bind(parseInt(membershipId), bungieDisplayName ?? '', bungieDisplayNameCode ?? 0, bungieDisplayName ?? '', bungieDisplayNameCode ?? 0)
		.run();

	return Response.json(results);
}
