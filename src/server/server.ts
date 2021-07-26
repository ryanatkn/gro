import {createServer as create_http1_server} from 'http';
import type {
	Server as Http1_Server,
	RequestListener as Http1_Request_Listener,
	IncomingHttpHeaders,
	OutgoingHttpHeaders,
} from 'http';
import {createSecureServer as create_http2_server} from 'http2';
import type {Http2Server, ServerHttp2Stream} from 'http2';
import type {ListenOptions} from 'net';
import {cyan, yellow, gray, red, rainbow, green} from '@feltcoop/felt/util/terminal.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {strip_after} from '@feltcoop/felt/util/string.js';
import type {Assignable} from '@feltcoop/felt/util/types.js';
import {to_env_number, to_env_string} from '@feltcoop/felt/util/env.js';
import {promisify} from 'util';

import type {Filer} from 'src/build/Filer.js';
import {
	get_file_mime_type,
	get_file_content_buffer,
	get_file_stats,
	get_file_content_hash,
} from '../build/filer_file.js';
import type {Base_Filer_File} from 'src/build/filer_file.js';
import {paths} from '../paths.js';
import {load_package_json} from '../utils/package_json.js';
import type {Project_State} from 'src/server/project_state.js';
import type {Filesystem} from 'src/fs/filesystem.js';

type Http2StreamHandler = (
	stream: ServerHttp2Stream,
	headers: IncomingHttpHeaders,
	flags: number,
) => void;

export interface Gro_Server {
	readonly server: Http1_Server | Http2Server;
	start(): Promise<void>;
	close(): Promise<void>;
	readonly host: string;
	readonly port: number;
}

export const DEFAULT_SERVER_HOST = to_env_string('GRO_HOST', 'localhost');
export const DEFAULT_SERVER_PORT = to_env_number('GRO_PORT', 8999);

export interface Options {
	filer: Filer;
	host?: string;
	port?: number;
	https?: {cert: string; key: string} | null;
	log?: Logger;
}

export const create_gro_server = (options: Options): Gro_Server => {
	const {
		filer,
		host = DEFAULT_SERVER_HOST,
		port = DEFAULT_SERVER_PORT,
		https = null,
		log = new System_Logger(print_log_label('server', cyan)),
	} = options;

	let final_port = port;
	const next_port = () => {
		// hacky but w/e - these values are not final until `gro_server.start` resolves
		final_port--;
		listen_options.port = final_port;
		(gro_server as Assignable<Gro_Server>).port = final_port;
	};

	const listen_options: ListenOptions = {
		host,
		port,
		// backlog?: number;
		// path?: string;
		// exclusive?: boolean;
		// readableAll?: boolean;
		// writableAll?: boolean;
		// ipv6Only?: boolean;
	};
	let server: Http1_Server | Http2Server;
	if (https) {
		server = create_http2_server(https);
		server.on('error', (err) => log.error(err));
		server.on('stream', create_http2_stream_listener(filer, log));
	} else {
		server = create_http1_server(create_http1_request_listener(filer, log));
	}
	let reject: (err: Error) => void;
	server.on('error', (err) => {
		if ((err as any).code === 'EADDRINUSE') {
			log.trace(`port ${yellow(final_port)} is busy, trying next`);
			next_port();
			setTimeout(() => {
				server.close();
				server.listen(listen_options); // original listener is still there
			}, 0);
		} else {
			reject(err);
		}
	});

	let started = false;

	const gro_server: Gro_Server = {
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
				server.listen(listen_options, () => {
					log.trace(
						`${rainbow('listening')} ${https ? cyan('https://') : ''}${green(
							`${host}:${final_port}`,
						)}`,
					);
					resolve();
				});
			});
		},
		close: async () => {
			await promisify(server.close.bind(server))();
			log.trace(rainbow('closed'));
		},
	};
	return gro_server;
};

const create_http2_stream_listener = (filer: Filer, log: Logger): Http2StreamHandler => {
	return async (stream, headers) => {
		const raw_url = headers[':path'] as string;
		if (!raw_url) return stream.end();
		const response = await to_response(raw_url, headers, filer, log);
		response.headers[':status'] = response.status; // http2 does its own thing
		stream.respond(response.headers);
		stream.end(response.data);
	};
};

const create_http1_request_listener = (filer: Filer, log: Logger): Http1_Request_Listener => {
	const request_listener: Http1_Request_Listener = async (req, res) => {
		if (!req.url) return;
		const response = await to_response(req.url, req.headers, filer, log);
		res.writeHead(response.status, response.headers);
		res.end(response.data);
	};
	return request_listener;
};

interface Gro_Server_Response {
	status: 200 | 304 | 404;
	headers: OutgoingHttpHeaders;
	data?: string | Buffer | undefined;
}

const to_response = async (
	raw_url: string,
	headers: IncomingHttpHeaders,
	filer: Filer,
	log: Logger,
): Promise<Gro_Server_Response> => {
	const url = parse_url(raw_url);
	const local_path = to_local_path(url);
	log.trace('serving', gray(raw_url), '→', gray(local_path));

	// TODO refactor - see `./project_state.ts` for more
	// can we get a virtual source file with an etag? (might need to sort files if they're not stable?)
	// also, `src/` is hardcoded below in `paths.source`s
	const SOURCE_ROOT_MATCHER = /^\/src\/?$/;
	if (SOURCE_ROOT_MATCHER.test(url)) {
		const project_state: Project_State = {
			build_dir: filer.build_dir,
			source_dir: paths.source,
			items: Array.from(filer.source_meta_by_id.values()),
			build_configs: filer.build_configs!,
			package_json: await load_package_json(filer.fs),
		};
		return {
			status: 200,
			headers: {'Content-Type': 'application/json'},
			data: JSON.stringify(project_state),
		};
	}

	// search for a file with this path
	let file = await filer.find_by_path(local_path);
	if (!file) {
		// TODO this is just temporary - the more correct code is below. The filer needs to support directories.
		file = await filer.find_by_path(`${local_path}/index.html`);
	}
	// if (file?.type === 'directory') { // or `file?.isDirectory`
	// 	file = filer.find_by_id(file.id + '/index.html');
	// }

	// 404 - not found
	if (!file) {
		log.info(`${yellow('404')} ${red(local_path)}`);
		return {
			status: 404,
			headers: {'Content-Type': 'text/plain; charset=utf-8'},
			data: `404 not found: ${url}`,
		};
	}

	// 304 - not modified
	const etag = headers['if-none-match'];
	if (etag && etag === to_etag(file)) {
		log.info(`${yellow('304')} ${gray(local_path)}`);
		return {status: 304, headers: {}};
	}

	// 200 - ok
	log.info(`${yellow('200')} ${gray(local_path)}`);
	return {
		status: 200,
		headers: await to_200_headers(filer.fs, file),
		data: get_file_content_buffer(file),
	};
};

const parse_url = (raw: string): string => decodeURI(strip_after(raw, '?'));

// TODO need to rethink this
const to_local_path = (url: string): string => {
	const relative_url = url[0] === '/' ? url.substring(1) : url;
	const relative_path =
		!relative_url || relative_url.endsWith('/') ? `${relative_url}index.html` : relative_url;
	return relative_path;
};

const to_etag = (file: Base_Filer_File): string => `"${get_file_content_hash(file)}"`;

const to_200_headers = async (
	fs: Filesystem,
	file: Base_Filer_File,
): Promise<OutgoingHttpHeaders> => {
	// TODO where do we get fs? the server? the filer?
	const stats = await get_file_stats(fs, file);
	const mime_type = get_file_mime_type(file);
	const headers: OutgoingHttpHeaders = {
		'Content-Type':
			mime_type === null
				? 'application/octet-stream'
				: file.encoding === 'utf8'
				? `${mime_type}; charset=utf-8`
				: mime_type,
		'Content-Length': stats.size,
		ETag: to_etag(file),

		// TODO any of these helpful?
		// 'Last-Modified': stats.mtime.toUTCString(),
		// 'Cache-Control': 'no-cache,must-revalidate',
		// 'Cache-Control': 'must-revalidate',

		// TODO probably support various types of resource caching,
		// especially if we output files with content hashes.
		// 'Cache-Control': 'immutable',
		// 'Cache-Control': 'max-age=31536000',
	};
	// console.log('res headers', gray(file.id), headers);
	return headers;
};
