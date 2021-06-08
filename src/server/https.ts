import {join} from 'path';
import {to_env_string} from '@feltcoop/felt/util/env.js';
import type {Logger} from '@feltcoop/felt/util/log.js';

import type {Filesystem} from '../fs/filesystem.js';

export interface HttpsCredentials {
	cert: string;
	key: string;
}

const DEFAULT_CERT_FILE: string = to_env_string('GRO_CERT_FILE', () =>
	join(process.cwd(), 'localhost-cert.pem'),
);
const DEFAULT_CERTKEY_FILE: string = to_env_string('GRO_CERTKEY_FILE', () =>
	join(process.cwd(), 'localhost-privkey.pem'),
);

// Tries to load the given cert and key, returning `null` if unable.
export const load_https_credentials = async (
	fs: Filesystem,
	log: Logger,
	cert_file = DEFAULT_CERT_FILE,
	key_file = DEFAULT_CERTKEY_FILE,
): Promise<HttpsCredentials | null> => {
	const [cert_exists, key_exists] = await Promise.all([fs.exists(cert_file), fs.exists(key_file)]);
	if (!cert_exists && !key_exists) return null;
	if (cert_exists && !key_exists) {
		log.warn('https cert exists but the key file does not', key_file);
		return null;
	}
	if (!cert_exists && key_exists) {
		log.warn('https key exists but the cert file does not', cert_file);
		return null;
	}
	const [cert, key] = await Promise.all([
		fs.read_file(cert_file, 'utf8'),
		fs.read_file(key_file, 'utf8'),
	]);
	return {cert, key};
};
