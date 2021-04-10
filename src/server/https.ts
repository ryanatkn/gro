import {join} from 'path';
import type {Filesystem} from '../fs/filesystem.js';

import {toEnvString} from '../utils/env.js';
import type {Logger} from '../utils/log.js';

export interface HttpsCredentials {
	cert: string;
	key: string;
}

const DEFAULT_CERT_FILE: string = toEnvString('GRO_CERT_FILE', () =>
	join(process.cwd(), 'localhost-cert.pem'),
);
const DEFAULT_CERTKEY_FILE: string = toEnvString('GRO_CERTKEY_FILE', () =>
	join(process.cwd(), 'localhost-privkey.pem'),
);

// Tries to load the given cert and key, returning `null` if unable.
export const loadHttpsCredentials = async (
	fs: Filesystem,
	log: Logger,
	certFile = DEFAULT_CERT_FILE,
	keyFile = DEFAULT_CERTKEY_FILE,
): Promise<HttpsCredentials | null> => {
	const [certExists, keyExists] = await Promise.all([
		fs.pathExists(certFile),
		fs.pathExists(keyFile),
	]);
	if (!certExists && !keyExists) return null;
	if (certExists && !keyExists) {
		log.warn('https cert exists but the key file does not', keyFile);
		return null;
	}
	if (!certExists && keyExists) {
		log.warn('https key exists but the cert file does not', certFile);
		return null;
	}
	const [cert, key] = await Promise.all([
		fs.readFile(certFile, 'utf8'),
		fs.readFile(keyFile, 'utf8'),
	]);
	return {cert, key};
};
