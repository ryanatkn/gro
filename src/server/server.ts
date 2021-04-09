import {createServer as createHttp1Server} from 'http';
import type {
	Server as Http1Server,
	RequestListener as Http1RequestListener,
	IncomingHttpHeaders,
	OutgoingHttpHeaders,
} from 'http';
import {createSecureServer as createHttp2Server} from 'http2';
import type {Http2Server, ServerHttp2Stream} from 'http2';
import type {ListenOptions} from 'net';

import {cyan, yellow, gray, red, rainbow, green} from '../utils/terminal.js';
import {printLogLabel, SystemLogger} from '../utils/log.js';
import type {Logger} from '../utils/log.js';
import {stripAfter} from '../utils/string.js';
import {omitUndefined} from '../utils/object.js';
import type {Filer} from '../build/Filer.js';
import {
	getFileMimeType,
	getFileContentsBuffer,
	getFileStats,
	getFileContentsHash,
} from '../build/baseFilerFile.js';
import type {BaseFilerFile} from '../build/baseFilerFile.js';
import {paths} from '../paths.js';
import {loadPackageJson} from '../project/packageJson.js';
import type {ProjectState} from './projectState.js';
import type {Assignable, PartialExcept} from '../index.js';
import {toEnvNumber, toEnvString} from '../utils/env.js';

type Http2StreamHandler = (
	stream: ServerHttp2Stream,
	headers: IncomingHttpHeaders,
	flags: number,
) => void;

export interface GroServer {
	readonly server: Http1Server | Http2Server;
	start(): Promise<void>;
	readonly host: string;
	readonly port: number;
}

export const DEFAULT_SERVER_HOST = toEnvString('GRO_HOST', 'localhost');
export const DEFAULT_SERVER_PORT = toEnvNumber('GRO_PORT', 8999);

export interface Options {
	filer: Filer;
	host: string;
	port: number;
	https: {cert: string; key: string; allowHTTP1?: boolean} | null;
	log: Logger;
}
export type RequiredOptions = 'filer';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		host: DEFAULT_SERVER_HOST,
		port: DEFAULT_SERVER_PORT,
		https: null,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger(printLogLabel('server', cyan)),
	};
};

export const createGroServer = (opts: InitialOptions): GroServer => {
	const options = initOptions(opts);
	const {filer, host, port, https, log} = options;

	let finalPort = port;
	const nextPort = () => {
		// hacky but w/e - these values are not final until `devServer.start` resolves
		finalPort--;
		listenOptions.port = finalPort;
		(devServer as Assignable<GroServer>).port = finalPort;
	};

	const listenOptions: ListenOptions = {
		host,
		port,
		// backlog?: number;
		// path?: string;
		// exclusive?: boolean;
		// readableAll?: boolean;
		// writableAll?: boolean;
		// ipv6Only?: boolean;
	};
	let server: Http1Server | Http2Server;
	if (https) {
		server = createHttp2Server(https);
		server.on('error', (err) => log.error(err));
		server.on('stream', createHttp2StreamListener(filer, log));
	} else {
		server = createHttp1Server(createHttp1RequestListener(filer, log));
	}
	let reject: (err: Error) => void;
	server.on('error', (err) => {
		if ((err as any).code === 'EADDRINUSE') {
			log.trace(`port ${yellow(finalPort)} is busy, trying next`);
			nextPort();
			setTimeout(() => {
				server.close();
				server.listen(listenOptions); // original listener is still there
			}, 0);
		} else {
			reject(err);
		}
	});

	let started = false;

	const devServer: GroServer = {
		server,
		host,
		port, // this value is not valid until `start` is complete
		start: async () => {
			if (started) throw Error('Server already started');
			started = true;

			// this is weird but it works I think.
			// the `on('error'` handler above does the catching
			await new Promise<void>((resolve, _reject) => {
				reject = _reject;
				server.listen(listenOptions, () => {
					log.trace(
						`${rainbow('listening')} ${https ? cyan('https://') : ''}${green(
							`${host}:${finalPort}`,
						)}`,
					);
					resolve();
				});
			});
		},
	};
	return devServer;
};

const createHttp2StreamListener = (filer: Filer, log: Logger): Http2StreamHandler => {
	return async (stream, headers) => {
		const rawUrl = headers[':path'] as string;
		if (!rawUrl) return stream.end();
		const response = await toResponse(rawUrl, headers, filer, log);
		response.headers[':status'] = response.status; // http2 does its own thing
		stream.respond(response.headers);
		stream.end(response.data);
	};
};

const createHttp1RequestListener = (filer: Filer, log: Logger): Http1RequestListener => {
	const requestListener: Http1RequestListener = async (req, res) => {
		if (!req.url) return;
		const response = await toResponse(req.url, req.headers, filer, log);
		res.writeHead(response.status, response.headers);
		res.end(response.data);
	};
	return requestListener;
};

const parseUrl = (raw: string): string => decodeURI(stripAfter(raw, '?'));

// TODO need to rethink this
const toLocalPath = (url: string): string => {
	const relativeUrl = url[0] === '/' ? url.substring(1) : url;
	const relativePath =
		!relativeUrl || relativeUrl.endsWith('/') ? `${relativeUrl}index.html` : relativeUrl;
	return relativePath;
};

const to200Headers = async (file: BaseFilerFile): Promise<OutgoingHttpHeaders> => {
	const stats = await getFileStats(file);
	const mimeType = getFileMimeType(file);
	const headers: OutgoingHttpHeaders = {
		'Content-Type':
			mimeType === null
				? 'application/octet-stream'
				: file.encoding === 'utf8'
				? `${mimeType}; charset=utf-8`
				: mimeType,
		'Content-Length': stats.size,
		ETag: toETag(file),

		// TODO any of these helpful?
		// 'Last-Modified': stats.mtime.toUTCString(),
		// 'Cache-Control': 'no-cache,must-revalidate',
		// 'Cache-Control': 'must-revalidate',

		// TODO probably support various types of resource caching,
		// especially if we output files with contents hashes.
		// 'Cache-Control': 'immutable',
		// 'Cache-Control': 'max-age=31536000',
	};
	// console.log('res headers', gray(file.id), headers);
	return headers;
};

const toETag = (file: BaseFilerFile): string => `"${getFileContentsHash(file)}"`;

interface GroServerResponse {
	status: 200 | 304 | 404;
	headers: OutgoingHttpHeaders;
	data?: string | Buffer | undefined;
}

const toResponse = async (
	rawUrl: string,
	headers: IncomingHttpHeaders,
	filer: Filer,
	log: Logger,
): Promise<GroServerResponse> => {
	const url = parseUrl(rawUrl);
	const localPath = toLocalPath(url);
	log.trace('serving', gray(rawUrl), '→', gray(localPath));

	// TODO refactor - see `./projectState.ts` for more
	// can we get a virtual source file with an etag? (might need to sort files if they're not stable?)
	// also, `src/` is hardcoded below in `paths.source`s
	const SOURCE_ROOT_MATCHER = /^\/src\/?$/;
	if (SOURCE_ROOT_MATCHER.test(url)) {
		const projectState: ProjectState = {
			buildDir: filer.buildDir,
			sourceDir: paths.source,
			items: Array.from(filer.sourceMetaById.values()),
			buildConfigs: filer.buildConfigs!,
			packageJson: await loadPackageJson(),
		};
		return {
			status: 200,
			headers: {'Content-Type': 'application/json'},
			data: JSON.stringify(projectState),
		};
	}

	// search for a file with this path
	let file = await filer.findByPath(localPath);
	if (!file) {
		// TODO this is just temporary - the more correct code is below. The filer needs to support directories.
		file = await filer.findByPath(`${localPath}/index.html`);
	}
	// if (file?.type === 'directory') { // or `file?.isDirectory`
	// 	file = filer.findById(file.id + '/index.html');
	// }

	// 404 - not found
	if (!file) {
		log.info(`${yellow('404')} ${red(localPath)}`);
		return {
			status: 404,
			headers: {'Content-Type': 'text/plain; charset=utf-8'},
			data: `404 not found: ${url}`,
		};
	}

	// 304 - not modified
	const etag = headers['if-none-match'];
	if (etag && etag === toETag(file)) {
		log.info(`${yellow('304')} ${gray(localPath)}`);
		return {status: 304, headers: {}};
	}

	// 200 - ok
	log.info(`${yellow('200')} ${gray(localPath)}`);
	return {
		status: 200,
		headers: await to200Headers(file),
		data: getFileContentsBuffer(file),
	};
};
