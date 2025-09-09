import { BungieMembershipType, PlatformErrorCodes } from 'bungie-api-ts/destiny2';
import { Env, TokenResponse } from '..';
import { createHttpUserClient } from '../httpClient';
import { getMembershipDataForCurrentUser } from 'bungie-api-ts/user';

export async function getMembershipInfo(env: Env, userToken: TokenResponse) {
	const httpUserClient = createHttpUserClient(fetch, env.API_KEY, {
		token_type: userToken.token_type,
		access_token: userToken.access_token,
	});

	const memberData = await getMembershipDataForCurrentUser(httpUserClient);

	if (memberData.ErrorCode !== PlatformErrorCodes.Success) {
		throw Error('failed to get member info');
	}

	const applicableMembershipTypes = memberData.Response.destinyMemberships[0].applicableMembershipTypes;

	let membershipId = '';
	let mainMembershipType = BungieMembershipType.None;

	const memberships = memberData.Response.destinyMemberships;

	for (let i = 0; i < memberships.length; i++) {
		if (memberships[i].crossSaveOverride === memberships[i].membershipType) {
			mainMembershipType = memberships[i].membershipType;
			membershipId = memberships[i].membershipId;
		}
	}

	if (membershipId == '' && mainMembershipType == BungieMembershipType.None) {
		membershipId = memberships[0].membershipId;
		mainMembershipType = memberships[0].membershipType;
	}

	return { membershipId, mainMembershipType };
}
