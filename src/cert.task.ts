import {spawn_process} from '@feltcoop/felt/util/process.js';

import type {Task} from './task/task.js';

export interface Task_Args {
	host?: string;
}

export const task: Task<Task_Args> = {
	summary: 'creates a self-signed cert for https with openssl',
	run: async ({fs, args}) => {
		const host = args.host || 'localhost';
		const cert_file = `${host}-cert.pem`;
		const key_file = `${host}-privkey.pem`;
		if (await fs.exists(cert_file)) throw Error(`File ${cert_file} already exists.`);
		if (await fs.exists(key_file)) throw Error(`File ${key_file} already exists.`);
		await spawn_process(
			'openssl',
			`req -x509 -newkey rsa:2048 -nodes -sha256 -subj /CN=${host} -keyout ${key_file} -out ${cert_file}`.split(
				' ',
			),
		);
	},
};
