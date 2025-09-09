import { Env } from '../index';
import { RefreshTokenResponse } from './refreshAccessToken';
import { insertLightlogRecord } from '../dbqueries/lightlogTable';
import { createHttpClient, createHttpUserClient } from '../httpClient';
import {
	DestinyComponentType,
	DestinyEquipmentSlotDefinition,
	DestinyInventoryItemDefinition,
	DestinyItemComponent,
	DestinyProfileResponse,
	getCharacter,
	getProfile,
	ItemBindStatus,
	PlatformErrorCodes,
} from 'bungie-api-ts/destiny2';
import { getMembershipInfo } from './getMembershipInfo';

export async function propagateLightlog(
	env: Env,
	userToken: RefreshTokenResponse,
	manifestInventory: {
		[key: number]: DestinyInventoryItemDefinition;
	},
	manifestEquipmentSlots: {
		[key: number]: DestinyEquipmentSlotDefinition;
	},
) {
	const http = createHttpUserClient(fetch, env.API_KEY, userToken.responseJson);

	const { membershipId, mainMembershipType } = await getMembershipInfo(env, userToken.responseJson);

	const characters = await getProfile(http, {
		destinyMembershipId: membershipId,
		membershipType: mainMembershipType,
		components: [
			DestinyComponentType.Characters,
			DestinyComponentType.ProfileInventories,
			DestinyComponentType.CharacterInventories,
			DestinyComponentType.CharacterEquipment,
			DestinyComponentType.ItemInstances,
			DestinyComponentType.ItemCommonData,
		],
	});

	if (characters.ErrorCode !== PlatformErrorCodes.Success) {
		console.log('Oops!');
		throw Error('uh oh!');
	}

	const totalTimePlayed = getTotalTimePlayed(characters.Response);

	const maxLightLevel = getMaxLightLevel(characters.Response, manifestInventory, manifestEquipmentSlots);

	const lightlogRecord = { membership_id: membershipId, max_light_level: maxLightLevel, total_time_played: totalTimePlayed };

	console.log(lightlogRecord);

	await insertLightlogRecord(env.loggr_db, lightlogRecord);
}

const getTotalTimePlayed = (characters: DestinyProfileResponse) => {
	const characterData = characters.characters.data;

	let totalTimePlayed = 0;

	for (const character in characterData) {
		totalTimePlayed += parseInt(characterData[character].minutesPlayedTotal);
	}

	return totalTimePlayed;
};

const getMaxLightLevel = (
	characters: DestinyProfileResponse,
	manifestInventory: {
		[key: number]: DestinyInventoryItemDefinition;
	},
	manifestEquipmentSlots: {
		[key: number]: DestinyEquipmentSlotDefinition;
	},
) => {
	//Get all user items and store them in one hyuge list
	const characterEquipment = characters.characterEquipment.data ?? {};
	const characterInventories = characters.characterInventories.data ?? {};
	const vault = characters.profileInventory.data?.items ?? [];

	let allItems: DestinyItemComponent[] = [];

	for (const character in characterEquipment) {
		allItems = allItems.concat(characterEquipment[character].items);
	}
	for (const character in characterInventories) {
		allItems = allItems.concat(characterInventories[character].items);
	}
	allItems = allItems.concat(vault);

	//get all instance data
	const itemInstances = characters.itemComponents.instances.data ?? {};

	//Slots list to only store items in slots we GAF about - dont care about sparrows and shit sorry !
	const slots = ['Kinetic Weapons', 'Energy Weapons', 'Power Weapons', 'Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Armor'];

	let buckets: Record<string, number[]> = {};

	allItems.forEach((item) => {
		const bucketHash = manifestInventory[item.itemHash].equippingBlock?.equipmentSlotTypeHash ?? 0;
		const slotName = manifestEquipmentSlots[bucketHash]?.displayProperties?.name ?? 'idfk';

		if (!slots.includes(slotName)) {
			return;
		}
		if (!buckets[slotName]) {
			buckets[slotName] = [];
		}
		if (item.itemInstanceId) {
			buckets[slotName].push(itemInstances[item.itemInstanceId]?.primaryStat?.value ?? 0);
		}
	});

	//Get the actual max power
	const bestInSlots = [];
	for (const bucket in buckets) {
		const biggest = buckets[bucket].reduce((prev, curr) => {
			return Math.max(prev, curr);
		});
		bestInSlots.push(biggest);
	}
	const maxLightLevel =
		bestInSlots.reduce((prev, curr) => {
			return prev + curr;
		}) / 8;

	return maxLightLevel;
};
