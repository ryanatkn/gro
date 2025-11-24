import type {Tome} from '@ryanatkn/fuz/tome.js';
import Api from '$routes/docs/api/+page.svelte';

export const tomes: Array<Tome> = [
	{
		name: 'api',
		category: 'reference',
		component: Api,
		related_tomes: [],
		related_modules: [],
		related_identifiers: [],
	},
];
