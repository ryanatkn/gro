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
import {resolve} from 'path';

import {cyan, yellow, gray} from '../colors/terminal.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {stripAfter} from '../utils/string.js';
import {omitUndefined} from '../utils/object.js';
import {
	FileCache,
	CompiledSourceFile,
	getFileMimeType,
	getFileBuffer,
	getFileStats,
} from '../fs/FileCache.js';

export interface DevServer {
	server: Server;
	start(): Promise<void>;
}

export interface Options {
	fileCache: FileCache;
	host: string;
	port: number;
	dir: string;
	log: Logger;
}
export type RequiredOptions = 'fileCache';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_HOST = 'localhost'; // or 0.0.0.0?
const DEFAULT_PORT = 8999;
export const initOptions = (opts: InitialOptions): Options => ({
	host: DEFAULT_HOST,
	port: DEFAULT_PORT,
	...omitUndefined(opts),
	dir: resolve(opts.dir || '.'),
	log: opts.log || new SystemLogger([cyan('[devServer]')]),
});

export const createDevServer = (opts: InitialOptions): DevServer => {
	const options = initOptions(opts);
	const {fileCache, host, port, dir, log} = options;

	const serverOptions: ServerOptions = {
		// IncomingMessage?: typeof IncomingMessage;
		// ServerResponse?: typeof ServerResponse;
	};
	const server = createServer(serverOptions, createRequestListener(fileCache, dir, log));
	const listen = server.listen.bind(server);
	server.listen = () => {
		throw Error(`Use devServer.start() instead of devServer.server.listen()`);
	};

	return {
		server,
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

const parseUrl = (raw: string): string => decodeURI(stripAfter(raw, '?'));

const toLocalPath = (dir: string, url: string): string => {
	const relativeUrl = url[0] === '/' ? '.' + url : url;
	const relativePath = relativeUrl.endsWith('/')
		? relativeUrl + 'index.html' // maybe handle others, like `.htm`?
		: relativeUrl;
	return resolve(dir, relativePath);
};

const send404FileNotFound = (req: IncomingMessage, res: ServerResponse, path: string) => {
	const headers: OutgoingHttpHeaders = {
		'Content-Type': 'text/plain',
	};
	res.writeHead(404, headers);
	res.end(`404 not found: ${req.url} -> ${path}`);
};

const send200FileFound = async (
	_req: IncomingMessage,
	res: ServerResponse,
	file: CompiledSourceFile,
) => {
	const stats = await getFileStats(file);
	const mimeType = getFileMimeType(file);
	let contentType = mimeType || '';
	if (file.encoding === 'utf8') contentType += '; charset=utf-8';
	const headers: OutgoingHttpHeaders = {
		'Content-Type': contentType,
		'Content-Length': stats.size,
		'Last-Modified': stats.mtime.toUTCString(),
	};
	res.writeHead(200, headers);
	res.end(getFileBuffer(file));
};

const createRequestListener = (fileCache: FileCache, dir: string, log: Logger): RequestListener => {
	const requestListener: RequestListener = (req, res) => {
		if (!req.url) return;
		const url = parseUrl(req.url);
		const localPath = toLocalPath(dir, url);
		log.trace('serving', gray(req.url), '→', gray(localPath));

		const file = fileCache.getCompiledFile(localPath);
		if (!file) {
			log.trace(`${yellow('404')} ${localPath}`);
			return send404FileNotFound(req, res, localPath);
		}
		log.trace(`${yellow('200')} ${localPath}`);
		return send200FileFound(req, res, file);
	};
	return requestListener;
};
