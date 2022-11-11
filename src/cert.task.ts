import {spawn} from '@feltcoop/util/process.js';
import {z} from 'zod';

import type {Task} from './task/task.js';

const Args = z
	.object({
		host: z
			.string({description: "the certificate host aka the common name, OpenSSL's CN arg"})
			.default('localhost'),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'creates a self-signed cert for https with openssl',
	Args,
	run: async ({fs, args}) => {
		const {host} = args;
		const certFile = `${host}-cert.pem`;
		const keyFile = `${host}-privkey.pem`;
		if (await fs.exists(certFile)) throw Error(`File ${certFile} already exists.`);
		if (await fs.exists(keyFile)) throw Error(`File ${keyFile} already exists.`);
		await spawn(
			'openssl',
			`req -x509 -newkey rsa:2048 -nodes -sha256 -subj /CN=${host} -keyout ${keyFile} -out ${certFile}`.split(
				' ',
			),
		);
	},
};
