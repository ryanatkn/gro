import type {ArgsSchema} from './task/task.js';

export const CertTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/CertTaskArgs.json',
	type: 'object',
	properties: {
		host: {
			type: 'string',
			default: 'localhost',
			description: "the certificate host aka the common name, OpenSSL's CN arg",
		},
	},
	additionalProperties: false,
};
