// @slop Claude Sonnet 4

import {parentPort} from 'node:worker_threads';
import {parse_imports} from './parse_imports.ts';
import type {Parse_Imports_Request, Parse_Imports_Response} from './parse_imports_worker_pool.ts';

if (!parentPort) {
	throw new Error('This script must be run as a worker thread');
}

parentPort.on('message', async (request: Parse_Imports_Request) => {
	const response: Parse_Imports_Response = {
		id: request.id,
		success: false,
	};

	try {
		const result = parse_imports(request.path_id, request.contents, request.ignore_types);
		response.success = true;
		response.result = result;
	} catch (error) {
		response.success = false;
		response.error = error instanceof Error ? error.message : String(error);
	}

	parentPort!.postMessage(response);
});
