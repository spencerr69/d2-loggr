import { getRefreshTokens, updateTokenRecord } from './dbqueries/tokensTable';
import { BungieMembershipType, DestinyComponentType, getProfile, PlatformErrorCodes } from 'bungie-api-ts/destiny2';
import { createHttpClient, createHttpUserClient } from './httpClient';
import { updateUserRecord } from './dbqueries/usersTable';
import { getMembershipDataForCurrentUser } from 'bungie-api-ts/user';
import { encode } from './functions/helpers';
import { refreshAccessToken } from './functions/refreshAccessToken';

// Setup lightlog table (log id, membership id, max light level, date, total time played, )
// actually like. make stuff lol

//setup env
export interface Env {
	loggr_db: D1Database;
	CLIENT_SECRET: string;
	client_id: string;
	API_KEY: string;
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	refresh_expires_in: number;
	membership_id: string;
}

export default {
	async fetch(req, env, _ctx) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		const httpClient = createHttpClient(fetch, env.API_KEY);

		if (pathname === '/api/auth') {
			if (url.searchParams.has('code')) {
				const tokenUrl = 'https://www.bungie.net/platform/app/oauth/token';

				const requestBody = {
					grant_type: 'authorization_code',
					code: url.searchParams.get('code') ?? '',
				};

				const response = await fetch(tokenUrl, {
					method: 'POST',
					headers: new Headers({
						Authorization: 'Basic ' + encode(env.client_id + ':' + env.CLIENT_SECRET),
						'Content-Type': 'application/x-www-form-urlencoded',
					}),
					body: new URLSearchParams(requestBody),
				});
				if (response.ok) {
					const responseJson: TokenResponse = await response.json();
					// const membershipId = parseInt(responseJson.membership_id);

					const httpUserClient = createHttpUserClient(fetch, env.API_KEY, {
						token_type: responseJson.token_type,
						access_token: responseJson.access_token,
					});

					const memberData = await getMembershipDataForCurrentUser(httpUserClient);
					if (memberData.ErrorCode !== PlatformErrorCodes.Success) {
						return Response.json(memberData);
					}

					const applicableMembershipTypes = memberData.Response.destinyMemberships[0].applicableMembershipTypes;
					const mainMembershipType = memberData.Response.destinyMemberships[0].membershipType;
					const membershipId = memberData.Response.destinyMemberships[0].membershipId;

					//when we get response we should save membership id, refresh token, refresh expiry, current date in tokens
					const _updateToken = await updateTokenRecord(
						env.loggr_db,
						membershipId,
						responseJson.refresh_token,
						responseJson.refresh_expires_in,
					);

					//get profile details and put into db
					const profile = await getProfile(httpClient, {
						membershipType: mainMembershipType,
						destinyMembershipId: membershipId,
						components: [DestinyComponentType.Profiles],
					});
					console.log(profile);

					if (profile.ErrorCode !== PlatformErrorCodes.Success) {
						return new Response(profile.Message);
					}

					const { bungieGlobalDisplayName, bungieGlobalDisplayNameCode } = profile.Response.profile.data?.userInfo ?? {};
					const _updateUser = await updateUserRecord(env.loggr_db, membershipId, bungieGlobalDisplayName, bungieGlobalDisplayNameCode);
					return new Response('Successfully authenticated and recorded user.', {
						status: 200,
						statusText: 'OK',
					});
				} else {
					return new Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
					});
				}
			} else {
				const bungieAuthUrl = new URL('https://www.bungie.net/en/oauth/authorize');
				bungieAuthUrl.searchParams.append('client_id', env.client_id);
				bungieAuthUrl.searchParams.append('response_type', 'code');

				//TODO: generate actual state string and ensure it is valid when receiving response
				bungieAuthUrl.searchParams.append('state', 'aaabbb');

				//do auth
				return new Response('' + bungieAuthUrl);
			}
		}

		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {
		// A Cron Trigger can make requests to other endpoints on the Internet,
		// publish to a Queue, query a D1 Database, and much more.
		//
		const refreshTokens = await getRefreshTokens(env.loggr_db);
		for (let i = 0; i < refreshTokens.length; i++) {
			const token = refreshTokens[i];
			const newToken = await refreshAccessToken(env, token['membership_id'], token['refresh_token']);
		}
	},
} satisfies ExportedHandler<Env>;
