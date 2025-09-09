import { getRefreshTokens, updateTokenRecord } from './dbqueries/tokensTable';
import {
	DestinyComponentType,
	DestinyManifestSlice,
	getDestinyManifest,
	getDestinyManifestSlice,
	getProfile,
	PlatformErrorCodes,
} from 'bungie-api-ts/destiny2';
import { createHttpClient } from './httpClient';
import { updateUserRecord } from './dbqueries/usersTable';
import { encode } from './functions/helpers';
import { refreshAccessToken, RefreshTokenResponse } from './functions/refreshAccessToken';
import { propagateLightlog } from './functions/propagateLightlog';
import { getMembershipInfo } from './functions/getMembershipInfo';

const MS_BETWEEN_MANIFESTS = 604800000;

export interface Env {
	loggr_db: D1Database;
	CLIENT_SECRET: string;
	client_id: string;
	API_KEY: string;
	r2_bucket: R2Bucket;
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	refresh_expires_in: number;
	membership_id: string;
}

export interface TokenErrorResponse {
	status: number;
	statusText: string;
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

				if (!response.ok) {
					return new Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
					});
				}

				const responseJson: TokenResponse = await response.json();

				const { membershipId, mainMembershipType } = await getMembershipInfo(env, responseJson);

				//log refresh token to Tokens table
				await updateTokenRecord(env.loggr_db, membershipId, responseJson.refresh_token, responseJson.refresh_expires_in);

				//log profile details to Users table
				const profile = await getProfile(httpClient, {
					membershipType: mainMembershipType,
					destinyMembershipId: membershipId,
					components: [DestinyComponentType.Profiles],
				});

				if (profile.ErrorCode !== PlatformErrorCodes.Success) {
					return new Response(profile.Message);
				}
				const { bungieGlobalDisplayName, bungieGlobalDisplayNameCode } = profile.Response.profile.data?.userInfo ?? {};
				if (!bungieGlobalDisplayName || !bungieGlobalDisplayNameCode) {
					return new Response('Couldnt get full display name', {
						status: 500,
						statusText: 'Internal Server Error',
					});
				}
				await updateUserRecord(env.loggr_db, membershipId, bungieGlobalDisplayName, bungieGlobalDisplayNameCode);

				console.log({
					membershipId: membershipId,
					bungieDisplayName: bungieGlobalDisplayName,
					bungieDisplayNameCode: bungieGlobalDisplayNameCode,
				});

				return new Response('Successfully authenticated and recorded user.', {
					status: 200,
					statusText: 'OK',
				});
			} else {
				// bungie auth url logic to be solely on client side
				// const bungieAuthUrl = new URL('https://www.bungie.net/en/oauth/authorize');
				// bungieAuthUrl.searchParams.append('client_id', env.client_id);
				// bungieAuthUrl.searchParams.append('response_type', 'code');

				// const state = crypto.randomUUID();
				// bungieAuthUrl.searchParams.append('state', state);

				return new Response('Please send the code you freaking NERD !', {
					status: 401,
					statusText: 'unauthorised',
				});
			}
		}

		return new Response('', {
			status: 404,
			statusText: 'Not Found',
		});
	},

	// Scheduled is invoked with cron trigger
	async scheduled(event, env, ctx): Promise<void> {
		let manifestTables: DestinyManifestSlice<('DestinyInventoryItemDefinition' | 'DestinyEquipmentSlotDefinition')[]> | undefined =
			undefined;

		const manifest = await env.r2_bucket.get('manifest.json');

		if (manifest == null || Date.now() - manifest.uploaded.valueOf() > MS_BETWEEN_MANIFESTS) {
			console.log({ message: 'Downloading new manifest.', previousManifestDate: manifest?.uploaded });

			const httpClient = createHttpClient(fetch, env.API_KEY);
			const destinyManifest = await getDestinyManifest(httpClient);
			manifestTables = await getDestinyManifestSlice(httpClient, {
				destinyManifest: destinyManifest.Response,
				language: 'en',
				tableNames: ['DestinyInventoryItemDefinition', 'DestinyEquipmentSlotDefinition'],
			});

			await env.r2_bucket.put('manifest.json', JSON.stringify(manifestTables));
		} else {
			manifestTables = JSON.parse(await manifest.text());
		}

		if (manifestTables === undefined) {
			throw Error("Couldn't get manifest. FLOP !");
		}

		const refreshTokens = await getRefreshTokens(env.loggr_db);

		const tokenPromises = refreshTokens.map((token) => {
			return refreshAccessToken(env, token.membership_id, token.refresh_token);
		});
		const tokens = await Promise.all(tokenPromises);

		const filteredTokens = tokens.filter((token) => {
			return !(token as TokenErrorResponse).status;
		}) as RefreshTokenResponse[];

		const lightlogPromises = filteredTokens.map((token) => {
			return propagateLightlog(env, token, manifestTables.DestinyInventoryItemDefinition, manifestTables.DestinyEquipmentSlotDefinition);
		});
		await Promise.all(lightlogPromises);

		// for (let i = 0; i < filteredTokens.length; i++) {
		// 	await propagateLightlog(
		// 		env,
		// 		filteredTokens[i],
		// 		manifestTables.DestinyInventoryItemDefinition,
		// 		manifestTables.DestinyEquipmentSlotDefinition,
		// 	);
		// }
	},
} satisfies ExportedHandler<Env>;
