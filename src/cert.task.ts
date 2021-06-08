import {spawn_process} from '@feltcoop/felt/utils/process.js';

import type {Task} from './task/task.js';

export interface Task_Args {
	host?: string;
}

export const task: Task<Task_Args> = {
	description: 'creates a self-signed cert for https with openssl',
	run: async ({fs, args}) => {
		const host = args.host || 'localhost';
		const certFile = `${host}-cert.pem`;
		const keyFile = `${host}-privkey.pem`;
		if (await fs.exists(certFile)) throw Error(`File ${certFile} already exists. Canceling.`);
		if (await fs.exists(keyFile)) throw Error(`File ${keyFile} already exists. Canceling.`);
		await spawn_process(
			'openssl',
			`req -x509 -newkey rsa:2048 -nodes -sha256 -subj /CN=${host} -keyout ${keyFile} -out ${certFile}`.split(
				' ',
			),
		);
	},
};
