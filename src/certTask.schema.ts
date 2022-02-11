import {type ArgsSchema} from './utils/args.js';

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
	required: ['host'],
	additionalProperties: false,
};
