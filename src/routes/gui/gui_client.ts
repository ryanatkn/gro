import type {Gui_Message, Receive_Gui_Message, Send_Gui_Message} from './gui_message.js';

export interface Options {
	send: Send_Gui_Message;
	receive: (message: Gui_Message) => void;
}

export class Gui_Client {
	#send: Send_Gui_Message;
	#receive: Receive_Gui_Message;

	constructor(options: Options) {
		console.log('[gui_client] creating');
		this.#send = options.send;
		this.#receive = options.receive;
	}

	send(message: Gui_Message): void {
		this.#send(message);
	}

	receive(message: Gui_Message): void {
		console.log(`[gui_client] message`, message);
		this.#receive(message);
	}
}
