/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Buffer } from 'node:buffer';
import updateRefreshToken from './dbqueries/updateRefreshToken';

const decode = (str: string): string => Buffer.from(str, 'base64').toString('binary');
const encode = (str: string): string => Buffer.from(str, 'binary').toString('base64');

//setup env
export interface Env {
	loggr_db: D1Database;
	CLIENT_SECRET: string;
	client_id: string;
}

interface TokenResponse {
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

					const membershipId = parseInt(responseJson.membership_id);

					//when we get response we should save membership id, refresh token, refresh expiry, current date in tokens
					const results = await updateRefreshToken(env.loggr_db, membershipId, responseJson.refresh_token, responseJson.expires_in);

					return Response.json(results);
				} else {
					return new Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
					});
				}
			} else {
				const bungieAuthUrl = new URL('https://www.bungie.net/en/oauth/authorize');
				bungieAuthUrl.searchParams.append('client_id', '50746');
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
		// We'll keep it simple and make an API call to a Cloudflare API:
		let resp = await fetch('https://api.cloudflare.com/client/v4/ips');
		let wasSuccessful = resp.ok ? 'success' : 'fail';

		// You could store this result in KV, write to a D1 Database, or publish to a Queue.
		// In this template, we'll just log the result:
		console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);
	},
} satisfies ExportedHandler<Env>;
