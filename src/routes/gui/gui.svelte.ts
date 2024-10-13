import {SvelteMap} from 'svelte/reactivity';
import {create_deferred, type Deferred} from '@ryanatkn/belt/async.js';

import type {Source_File} from '../../lib/filer.js';
import type {Path_Id} from '../../lib/path.js';
import type {Gui_Client} from './gui_client.js';
import type {Prompt_Response_Message} from './gui_message.js';

export interface Options {
	client: Gui_Client;
}

export class Gui {
	files_by_id: SvelteMap<Path_Id, Source_File> = new SvelteMap();

	client: Gui_Client;

	pending_prompts: SvelteMap<string, Deferred<Prompt_Response_Message>> = new SvelteMap();

	constructor(options: Options) {
		console.log('[gui] creating');
		this.client = options.client;
	}

	async send_prompt(text: string): Promise<void> {
		// TODO need ids, and then the response promise, tracking by text isn't robust to duplicates
		this.client.send({type: 'send_prompt', text});
		const deferred = create_deferred<Prompt_Response_Message>();
		this.pending_prompts.set(text, deferred);
		const response = await deferred.promise;
		console.log(`prompt response`, response);
		this.pending_prompts.delete(text);
	}

	// TODO BLOCK do this somehow
	receive_prompt_response(message: Prompt_Response_Message) {
		const pending = this.pending_prompts.get(message.text);
		if (!pending) {
			console.error('expected pending', message);
			return;
		}
		pending.resolve(message);
		this.pending_prompts.delete(message.text); // deleting intentionally after resolving to maybe avoid a corner case loop of sending the same prompt again
	}
}
