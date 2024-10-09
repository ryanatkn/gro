import {SvelteMap} from 'svelte/reactivity';

import type {Source_File} from '../../lib/filer.js';
import type {Path_Id} from '../../lib/path.js';
import type {Gui_Client} from './gui_client.js';

export interface Options {
	client: Gui_Client;
}

export class Gui {
	files_by_id: SvelteMap<Path_Id, Source_File> = new SvelteMap();

	client: Gui_Client;

	constructor(options: Options) {
		console.log('[gui] creating');
		this.client = options.client;
	}
}
