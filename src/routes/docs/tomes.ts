import type {Tome} from '@fuzdev/fuz_ui/tome.js';
import ApiPage from '$routes/docs/api/+page.svelte';
import LibraryPage from '$routes/docs/library/+page.svelte';

export const tomes: Array<Tome> = [
	{
		name: 'api',
		category: 'reference',
		Component: ApiPage,
		related_tomes: [],
		related_modules: [],
		related_declarations: [],
	},
	{
		name: 'library',
		category: 'reference',
		Component: LibraryPage,
		related_tomes: [],
		related_modules: [],
		related_declarations: [],
	},
];
