import type {Source_File} from '../../lib/filer.js';
import type {Watcher_Change} from '../../lib/watch_dir.js';

export type Gui_Message =
	| Gui_Echo_Message
	| Gui_Load_Session
	| Gui_Loaded_Session
	| Gui_Filer_Change;

export interface Base_Gui_Message {
	type: string;
}

export interface Gui_Echo_Message extends Base_Gui_Message {
	type: 'echo';
	data: unknown;
}

export interface Gui_Load_Session extends Base_Gui_Message {
	type: 'load_session';
}

export interface Gui_Loaded_Session extends Base_Gui_Message {
	type: 'loaded_session'; // TODO req/res pair instead of separate message?
	data: string; // TODO using `devalue` manually
}

export interface Gui_Filer_Change extends Base_Gui_Message {
	type: 'filer_change';
	change: Watcher_Change;
	source_file: Source_File;
}

// TODO are these useful?
export type Send_Gui_Message = (message: Gui_Message) => void;
export type Receive_Gui_Message = (message: Gui_Message) => void;
