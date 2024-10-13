import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import * as devalue from 'devalue';

import {Filer, type Cleanup_Watch} from '../../lib/filer.js';

import type {Client_Message, Server_Message} from './gui_message.js';

export interface Options {
	send: (message: Server_Message) => void;
	filer?: Filer;
}

export class Gui_Server {
	#send: (message: Server_Message) => void;

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

	send(message: Server_Message): void {
		this.#send(message);
	}

	// TODO add an abstraction here, so the server isn't concerned with message content/types
	receive(message: Client_Message): void {
		console.log(`[gui_server.receive] message`, message, message.type === 'load_session');
		switch (message.type) {
			case 'echo': {
				this.send(message);
				break;
			}
			case 'load_session': {
				this.send({
					type: 'loaded_session',
					data: devalue.stringify(Array.from(this.filer.files.values())),
				});
				break;
			}
			case 'send_prompt': {
				break;
			}
			default:
				throw new Unreachable_Error(message);
		}
	}

	async destroy(): Promise<void> {
		await (
			await this.#cleanup_filer
		)();
	}
}
