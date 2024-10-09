import type {Gui_Message, Send_Gui_Message} from './gui.js';

export interface Options {
	send: (message: Gui_Message) => void;
}

export class Gui_Client {
	#send: Send_Gui_Message;

	constructor(options: Options) {
		console.log('CREATE Gui');
		this.#send = options.send;
	}

	send(message: Gui_Message): void {
		this.#send(message);
	}

	receive(message: Gui_Message): void {
		console.log(`message`, message);
	}
}
