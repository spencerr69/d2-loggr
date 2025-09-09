export async function insertLightlogRecord(db: D1Database, lightlogRecord: LightlogRecord) {
	const { results } = await db
		.prepare("INSERT INTO Lightlog (membership_id, max_light_level, total_time_played, date) VALUES (?, ?, ?, date('now'));")
		.bind(lightlogRecord.membership_id, lightlogRecord.max_light_level, lightlogRecord.total_time_played)
		.run();

	return Response.json(results);
}

type LightlogRecord = {
	log_id?: number;
	membership_id: string;
	max_light_level: number;
	total_time_played: number;
	date?: string;
};
