import { CLIENT_RENEG_WINDOW } from 'node:tls';
import { TokenResponse, Env } from '..';
import { updateTokenRecord } from '../dbqueries/tokensTable';
import { encode } from './helpers';

export async function refreshAccessToken(env: Env, membershipId: string, refresh_token: string) {
	const tokenUrl = 'https://www.bungie.net/platform/app/oauth/token';

	const requestBody = {
		grant_type: 'refresh_token',
		refresh_token: refresh_token,
		client_id: env.client_id,
		client_secret: env.CLIENT_SECRET,
	};

	const response = await fetch(tokenUrl, {
		method: 'POST',
		headers: new Headers({
			'Content-Type': 'application/x-www-form-urlencoded',
		}),
		body: new URLSearchParams(requestBody),
	});

	if (!response.ok) {
		return new Response('flop', {
			status: response.status,
		});
	}

	const responseJson: TokenResponse = await response.json();
	// const membershipId = parseInt(responseJson.membership_id);

	//when we get response we should save membership id, refresh token, refresh expiry, current date in tokens
	const _updateToken = await updateTokenRecord(env.loggr_db, membershipId, responseJson.refresh_token, responseJson.refresh_expires_in);

	return responseJson;
}
