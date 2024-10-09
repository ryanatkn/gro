export type Gui_Message = Gui_Echo_Message | Gui_Get_Session;

export interface Base_Gui_Message {
	type: string;
}

export interface Gui_Echo_Message extends Base_Gui_Message {
	type: 'echo';
	data: unknown;
}

export interface Gui_Get_Session extends Base_Gui_Message {
	type: 'get_session';
}

export type Send_Gui_Message = (message: Gui_Message) => void;
