import {pathExists} from './fs/nodeFs.js';
import type {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';

export interface TaskArgs {
	host?: string;
}

export const task: Task<TaskArgs> = {
	description: 'creates a self-signed cert for https with openssl',
	run: async ({args}) => {
		const host = args.host || 'localhost';
		const certFile = `${host}-cert.pem`;
		const keyFile = `${host}-privkey.pem`;
		if (await pathExists(certFile)) throw Error(`File ${certFile} already exists. Aborting.`);
		if (await pathExists(keyFile)) throw Error(`File ${keyFile} already exists. Aborting.`);
		await spawnProcess(
			'openssl',
			`req -x509 -newkey rsa:2048 -nodes -sha256 -subj /CN=${host} -keyout ${keyFile} -out ${certFile}`.split(
				' ',
			),
		);
	},
};
