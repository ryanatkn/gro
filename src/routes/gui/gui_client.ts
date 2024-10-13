import type {Client_Message, Server_Message} from './gui_message.js';

export interface Options {
	send: (message: Client_Message) => void;
	receive: (message: Server_Message) => void;
}

export class Gui_Client {
	#send: (message: Client_Message) => void;
	#receive: (message: Server_Message) => void;

	constructor(options: Options) {
		console.log('[gui_client] creating');
		this.#send = options.send;
		this.#receive = options.receive;
	}

	send(message: Client_Message): void {
		this.#send(message);
	}

	receive(message: Server_Message): void {
		console.log(`[gui_client] message`, message);
		this.#receive(message);
	}
}
