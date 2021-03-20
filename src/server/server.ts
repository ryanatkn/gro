import {
	createServer as createHttp1Server,
	Server as Http1Server,
	RequestListener as Http1RequestListener,
	ServerResponse as Http1ServerResponse,
	OutgoingHttpHeaders,
} from 'http';
import {
	createSecureServer as createHttp2Server,
	Http2Server,
	IncomingHttpHeaders,
	ServerHttp2Stream,
} from 'http2';
import {ListenOptions} from 'net';

import {cyan, yellow, gray, red, rainbow, green} from '../utils/terminal.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {stripAfter} from '../utils/string.js';
import {omitUndefined} from '../utils/object.js';
import {Filer} from '../build/Filer.js';
import {
	BaseFilerFile,
	getFileMimeType,
	getFileContentsBuffer,
	getFileStats,
	getFileContentsHash,
} from '../build/baseFilerFile.js';
import {paths} from '../paths.js';
import {loadPackageJson} from '../project/packageJson.js';
import {ProjectState} from './projectState.js';

type Http2StreamHandler = (
	stream: ServerHttp2Stream,
	headers: IncomingHttpHeaders,
	flags: number,
) => void;

export interface DevServer {
	readonly server: Http1Server | Http2Server;
	start(): Promise<void>;
	readonly host: string;
	readonly port: number;
}

export const DEFAULT_SERVER_HOST: string = process.env.HOST || 'localhost';
export const DEFAULT_SERVER_PORT: number = Number(process.env.PORT) || 8999;

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
		log: opts.log || new SystemLogger([cyan('[server]')]),
	};
};

export const createDevServer = (opts: InitialOptions): DevServer => {
	const options = initOptions(opts);
	const {filer, host, port, https, log} = options;

	let finalPort = port;
	const nextPort = () => {
		// hacky but w/e - these values are not final until `devServer.start` resolves
		finalPort--;
		listenOptions.port = finalPort;
		(devServer as Assignable<DevServer>).port = finalPort;
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

	const devServer: DevServer = {
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

// TODO refactor with `createHttp1RequestListener`, this is a lot of copypasta
const createHttp2StreamListener = (filer: Filer, log: Logger): Http2StreamHandler => {
	return async (stream, headers) => {
		const rawUrl = headers[':path'];
		if (!rawUrl) return stream.end();
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
			stream.respond({
				':status': 200,
				'Content-Type': 'application/json',
			});
			return stream.end(JSON.stringify(projectState));
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
		if (!file) {
			log.info(`${yellow('404')} ${red(localPath)}`);
			stream.respond({
				':status': 404,
				'Content-Type': 'text/plain; charset=utf-8',
			});
			return stream.end(`404 not found: ${url}`);
		}
		// console.log('req headers', gray(file.id), headers);
		const etag = headers['if-none-match'];
		if (etag && etag === toETag(file)) {
			log.info(`${yellow('304')} ${gray(localPath)}`);
			stream.respond({':status': 304});
			return stream.end();
		}
		log.info(`${yellow('200')} ${gray(localPath)}`);
		const responseHeaders = await to200Headers(file);
		responseHeaders[':status'] = 200;
		stream.respond(responseHeaders);
		return stream.end(getFileContentsBuffer(file));
	};
};

const createHttp1RequestListener = (filer: Filer, log: Logger): Http1RequestListener => {
	const requestListener: Http1RequestListener = async (req, res) => {
		if (!req.url) return;
		const url = parseUrl(req.url);
		const localPath = toLocalPath(url);
		log.trace('serving', gray(req.url), '→', gray(localPath));

		// TODO refactor - see `./projectState.ts` for more
		// can we get a virtual source file with an etag? (might need to sort files if they're not stable?)
		// also, `src/` is hardcoded below in `paths.source`s
		const SOURCE_ROOT_MATCHER = /^\/src\/?$/;
		if (SOURCE_ROOT_MATCHER.test(url)) {
			const headers: OutgoingHttpHeaders = {
				'Content-Type': 'application/json',
			};
			res.writeHead(200, headers);
			const projectState: ProjectState = {
				buildDir: filer.buildDir,
				sourceDir: paths.source,
				items: Array.from(filer.sourceMetaById.values()),
				buildConfigs: filer.buildConfigs!,
				packageJson: await loadPackageJson(),
			};
			res.end(JSON.stringify(projectState));
			return;
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
		if (!file) {
			log.info(`${yellow('404')} ${red(localPath)}`);
			return send404(res, url);
		}
		// console.log('req headers', gray(file.id), req.headers);
		const etag = req.headers['if-none-match'];
		if (etag && etag === toETag(file)) {
			log.info(`${yellow('304')} ${gray(localPath)}`);
			return send304(res);
		}
		log.info(`${yellow('200')} ${gray(localPath)}`);
		return send200(res, file);
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

const send404 = (res: Http1ServerResponse, url: string) => {
	const headers: OutgoingHttpHeaders = {
		'Content-Type': 'text/plain; charset=utf-8',
	};
	res.writeHead(404, headers);
	res.end(`404 not found: ${url}`);
};

const send304 = (res: Http1ServerResponse) => {
	res.writeHead(304);
	res.end();
};

const send200 = async (res: Http1ServerResponse, file: BaseFilerFile) => {
	const headers = await to200Headers(file);
	res.writeHead(200, headers);
	res.end(getFileContentsBuffer(file));
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
