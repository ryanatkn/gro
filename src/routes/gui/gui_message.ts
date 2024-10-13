import type Anthropic from '@anthropic-ai/sdk';

import type {Source_File} from '../../lib/filer.js';
import type {Watcher_Change} from '../../lib/watch_dir.js';

export type Client_Message = Echo_Message | Load_Session_Message | Send_Prompt_Message;

export type Server_Message =
	| Echo_Message
	| Loaded_Session_Message
	| Filer_Change_Message
	| Prompt_Response_Message;

export interface Base_Message {
	type: string;
}

/**
 * @client @server
 */
export interface Echo_Message extends Base_Message {
	type: 'echo';
	data: unknown;
}

/**
 * @client
 */
export interface Load_Session_Message extends Base_Message {
	type: 'load_session';
}

/**
 * @server
 */
export interface Loaded_Session_Message extends Base_Message {
	type: 'loaded_session'; // TODO req/res pair instead of separate message?
	data: string; // TODO using `devalue` manually
}

/**
 * @server
 */
export interface Filer_Change_Message extends Base_Message {
	type: 'filer_change';
	change: Watcher_Change;
	source_file: Source_File;
}

/**
 * @client
 */
export interface Send_Prompt_Message extends Base_Message {
	type: 'send_prompt';
	text: string;
}

/**
 * @server
 */
export interface Prompt_Response_Message extends Base_Message {
	type: 'prompt_response';
	data: Anthropic.Messages.Message;
}
