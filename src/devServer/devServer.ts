import {
	createServer,
	Server,
	ServerOptions,
	RequestListener,
	ServerResponse,
	IncomingMessage,
	OutgoingHttpHeaders,
} from 'http';
import {ListenOptions} from 'net';

import {cyan, yellow, gray, red} from '../colors/terminal.js';
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

export interface DevServer {
	readonly server: Server;
	start(): Promise<void>;
	readonly host: string;
	readonly port: number;
}

export interface Options {
	filer: Filer;
	host: string;
	port: number;
	log: Logger;
}
export type RequiredOptions = 'filer';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 8999;
export const initOptions = (opts: InitialOptions): Options => ({
	host: DEFAULT_HOST,
	port: DEFAULT_PORT,
	...omitUndefined(opts),
	log: opts.log || new SystemLogger([cyan('[devServer]')]),
});

export const createDevServer = (opts: InitialOptions): DevServer => {
	const options = initOptions(opts);
	const {filer, host, port, log} = options;

	const serverOptions: ServerOptions = {
		// IncomingMessage?: typeof IncomingMessage;
		// ServerResponse?: typeof ServerResponse;
	};
	const server = createServer(serverOptions, createRequestListener(filer, log));
	const listen = server.listen.bind(server);
	server.listen = () => {
		throw Error(`Use devServer.start() instead of devServer.server.listen()`);
	};

	return {
		server,
		host,
		port,
		start: async () => {
			return new Promise((resolve) => {
				const listenOptions: ListenOptions = {
					port,
					host,
					// backlog?: number;
					// path?: string;
					// exclusive?: boolean;
					// readableAll?: boolean;
					// writableAll?: boolean;
					// ipv6Only?: boolean;
				};
				listen(listenOptions, () => {
					log.trace('listening', listenOptions);
					resolve();
				});
			});
		},
	};
};

const createRequestListener = (filer: Filer, log: Logger): RequestListener => {
	const requestListener: RequestListener = async (req, res) => {
		if (!req.url) return;
		const url = parseUrl(req.url);
		const localPath = toLocalPath(url);
		log.trace('serving', gray(req.url), '→', gray(localPath));

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
			return send404(req, res);
		}
		// console.log('req headers', gray(file.id), req.headers);
		const etag = req.headers['if-none-match'];
		if (etag && etag === toETag(file)) {
			log.info(`${yellow('304')} ${gray(localPath)}`);
			return send304(res);
		}
		log.info(`${yellow('200')} ${gray(localPath)}`);
		return send200(req, res, file);
	};
	return requestListener;
};

const parseUrl = (raw: string): string => decodeURI(stripAfter(raw, '?'));

const toLocalPath = (url: string): string => {
	const relativeUrl = url[0] === '/' ? url.substring(1) : url;
	// This avoids making a second file query when we know the path is a directory.
	const relativePath =
		!relativeUrl || relativeUrl.endsWith('/') ? `${relativeUrl}index.html` : relativeUrl;
	return relativePath;
};

const send404 = (req: IncomingMessage, res: ServerResponse) => {
	const headers: OutgoingHttpHeaders = {
		'Content-Type': 'text/plain; charset=utf-8',
	};
	res.writeHead(404, headers);
	res.end(`404 not found: ${req.url}`);
};

const send304 = (res: ServerResponse) => {
	res.writeHead(304);
	res.end();
};

const send200 = async (_req: IncomingMessage, res: ServerResponse, file: BaseFilerFile) => {
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
		// TODO this works but not for source maps.
		// not sure why. browser isn't returning the 'if-modified-since' header
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
	res.writeHead(200, headers);
	res.end(getFileContentsBuffer(file));
};

const toETag = (file: BaseFilerFile): string => `"${getFileContentsHash(file)}"`;
