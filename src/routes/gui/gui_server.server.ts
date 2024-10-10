import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import * as devalue from 'devalue';

import {Filer, type Cleanup_Watch} from '../../lib/filer.js';

import type {Gui_Message, Send_Gui_Message} from './gui_message.js';

export interface Options {
	send: (message: Gui_Message) => void;
	filer?: Filer;
}

export class Gui_Server {
	#send: Send_Gui_Message;

	filer: Filer;

	#cleanup_filer: Promise<Cleanup_Watch>;

	constructor(options: Options) {
		console.log('CREATE Gui');
		this.#send = options.send;
		this.filer = options.filer ?? new Filer();
		this.#cleanup_filer = this.filer.watch((change, source_file) => {
			switch (change.type) {
				case 'add':
				case 'update':
				case 'delete': {
					this.#send({type: 'filer_change', change, source_file}); // TODO BLOCK shouldn't send unless inited
					break;
				}
				default:
					throw new Unreachable_Error(change.type);
			}
		});
	}

	send(message: Gui_Message): void {
		this.#send(message);
	}

	receive(message: Gui_Message): void {
		console.log(`[gui_server.receive] message`, message, message.type === 'load_session');
		if (message.type === 'echo') {
			this.send(message);
		} else if (message.type === 'load_session') {
			this.send({
				type: 'loaded_session',
				data: devalue.stringify(Array.from(this.filer.files.values())),
			});
		}
	}

	async destroy(): Promise<void> {
		await (
			await this.#cleanup_filer
		)();
	}
}
