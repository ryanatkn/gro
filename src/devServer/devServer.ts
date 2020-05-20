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
import {SystemLogger} from '../utils/log.js';
import {stripAfter} from '../utils/string.js';
import {loadFile, getMimeType, File} from '../fs/nodeFile.js';
import {omitUndefined} from '../utils/object.js';

export interface DevServer {
	server: Server;
	start(): Promise<void>;
}

export interface Options {
	host: string;
	port: number;
	dir: string;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_HOST = 'localhost'; // or 0.0.0.0?
const DEFAULT_PORT = 8999;
export const initOptions = (opts: InitialOptions): Options => ({
	host: DEFAULT_HOST,
	port: DEFAULT_PORT,
	...omitUndefined(opts),
	dir: resolve(opts.dir || '.'),
});

export const createDevServer = (opts: InitialOptions): DevServer => {
	const options = initOptions(opts);
	const {host, port, dir} = options;

	const log = new SystemLogger([cyan('[devServer]')]);

	const serverOptions: ServerOptions = {
		// IncomingMessage?: typeof IncomingMessage;
		// ServerResponse?: typeof ServerResponse;
	};
	const requestListener: RequestListener = async (req, res) => {
		if (!req.url) return;
		const url = parseUrl(req.url);
		const localPath = toLocalPath(dir, url);
		log.trace('serving', gray(req.url), '→', gray(localPath));

		const file = await loadFile(localPath);
		if (!file) {
			log.trace(`${yellow('404')} ${localPath}`);
			return send404FileNotFound(req, res, localPath);
		}
		log.trace(`${yellow('200')} ${localPath}`);
		return send200FileFound(req, res, file);
	};
	const server = createServer(serverOptions, requestListener);
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

const send200FileFound = (_req: IncomingMessage, res: ServerResponse, file: File) => {
	const headers: OutgoingHttpHeaders = {
		'Content-Length': file.stats.size,
		'Last-Modified': file.stats.mtime.toUTCString(),
	};
	// The http server throws an error if "Content-Type" is `undefined`,
	// so add it only if we can detect one.
	const mimeType = getMimeType(file);
	if (mimeType) headers['Content-Type'] = mimeType;
	res.writeHead(200, headers);
	res.end(file.data);
};
