import { HttpClient, HttpClientConfig } from 'bungie-api-ts/http';

//took much of this from DIM thank yew
export function createHttpClient(fetchFunction: typeof fetch, apiKey: string): HttpClient {
	return async <T>(config: HttpClientConfig) => {
		let url = config.url;
		if (config.params) {
			url = `${url}?${new URLSearchParams(config.params).toString()}`;
		}

		const fetchOptions = new Request(url, {
			method: config.method,
			body: config.body ? JSON.stringify(config.body) : undefined,
			headers: {
				'X-API-Key': apiKey,
				...(config.body ? { 'Content-Type': 'application/json' } : undefined),
			},
		});

		const response = await fetchFunction(fetchOptions);
		let data: T | undefined;
		try {
			data = (await response.json()) as T;
		} catch (e) {
			console.error(e);
		}

		return data!; // At this point it's not undefined, there would've been a parse error
	};
}

export function createHttpUserClient(
	fetchFunction: typeof fetch,
	apiKey: string,
	userAuth: { access_token: string; token_type: string },
): HttpClient {
	return async <T>(config: HttpClientConfig) => {
		let url = config.url;
		if (config.params) {
			url = `${url}?${new URLSearchParams(config.params).toString()}`;
		}

		const fetchOptions = new Request(url, {
			method: config.method,
			body: config.body ? JSON.stringify(config.body) : undefined,
			headers: {
				'X-API-Key': apiKey,
				Authorization: userAuth.token_type + ' ' + userAuth.access_token,
				...(config.body ? { 'Content-Type': 'application/json' } : undefined),
			},
		});

		const response = await fetchFunction(fetchOptions);
		let data: T | undefined;
		try {
			data = (await response.json()) as T;
		} catch (e) {
			console.error(e);
		}

		return data!; // At this point it's not undefined, there would've been a parse error
	};
}
