import {type ArgsSchema} from './utils/args.js';
import {DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT} from './server/server.js';

export const ServeTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/ServeTaskArgs.json',
	type: 'object',
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: ['.'],
			description: 'paths to serve',
		},
		host: {type: 'string', default: DEFAULT_SERVER_HOST, description: 'network address host'},
		port: {type: 'number', default: DEFAULT_SERVER_PORT, description: 'network address port'},
		// TODO this flag is weird, it detects https credentials but should probably be explicit and fail if not available
		insecure: {type: 'boolean', default: undefined, description: 'ignore https credentials'},
		cert: {type: 'string', default: undefined, description: 'https certificate file'},
		certkey: {type: 'string', default: undefined, description: 'https certificate key file'},
	},
	required: ['_', 'host', 'port'],
	additionalProperties: false,
};
