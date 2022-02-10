import {spawn} from '@feltcoop/felt/util/process.js';

import {type Task} from './task/task.js';
import {type CertTaskArgs} from './certTask.js';
import {CertTaskArgsSchema} from './certTask.schema.js';

export const task: Task<CertTaskArgs> = {
	summary: 'creates a self-signed cert for https with openssl',
	args: CertTaskArgsSchema,
	run: async ({fs, args}) => {
		const host = args.host || 'localhost';
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
