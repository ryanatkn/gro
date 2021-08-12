import {spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';

export interface TaskArgs {
	host?: string;
}

export const task: Task<TaskArgs> = {
	summary: 'creates a self-signed cert for https with openssl',
	run: async ({fs, args}) => {
		const host = args.host || 'localhost';
		const cert_file = `${host}-cert.pem`;
		const key_file = `${host}-privkey.pem`;
		if (await fs.exists(cert_file)) throw Error(`File ${cert_file} already exists.`);
		if (await fs.exists(key_file)) throw Error(`File ${key_file} already exists.`);
		await spawn(
			'openssl',
			`req -x509 -newkey rsa:2048 -nodes -sha256 -subj /CN=${host} -keyout ${key_file} -out ${cert_file}`.split(
				' ',
			),
		);
	},
};
