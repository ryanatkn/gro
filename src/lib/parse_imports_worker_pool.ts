// @slop Claude Sonnet 4

import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';

import type {Path_Id} from './path.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Parse_Imports_Request {
	id: string;
	path_id: Path_Id;
	contents: string;
	ignore_types: boolean;
}

export interface Parse_Imports_Response {
	id: string;
	success: boolean;
	result?: Array<string>;
	error?: string;
}

export interface Parse_Imports_Worker_Pool_Options {
	size?: number;
	timeout_ms?: number;
}

/**
 * Worker pool for CPU-intensive import parsing.
 * Uses round-robin distribution and handles worker failures gracefully.
 */
export class Parse_Imports_Worker_Pool {
	readonly #workers: Array<Worker> = [];
	readonly #pending_requests: Map<
		string,
		{resolve: (result: Array<string>) => void; reject: (error: Error) => void}
	> = new Map();
	readonly #worker_script_path: string;
	readonly #timeout_ms: number;

	#next_worker_index = 0;
	#disposed = false;

	constructor(options: Parse_Imports_Worker_Pool_Options = {}) {
		const size = options.size ?? 4;
		this.#timeout_ms = options.timeout_ms ?? 5000;
		this.#worker_script_path = resolve(__dirname, 'parse_imports_worker.js');

		for (let i = 0; i < size; i++) {
			this.#create_worker();
		}
	}

	/**
	 * Create a new worker and set up handlers.
	 */
	#create_worker(): void {
		const worker = new Worker(this.#worker_script_path);

		worker.on('message', (response: Parse_Imports_Response) => {
			const pending = this.#pending_requests.get(response.id);
			if (!pending) return;

			this.#pending_requests.delete(response.id);

			if (response.success) {
				pending.resolve(response.result ?? []);
			} else {
				pending.reject(new Error(response.error ?? 'Unknown worker error'));
			}
		});

		worker.on('error', (error) => {
			// Worker crashed - reject all pending requests for this worker
			// and restart the worker
			this.#handle_worker_error(worker, error);
		});

		worker.on('exit', (code) => {
			if (code !== 0) {
				this.#handle_worker_error(worker, new Error(`Worker exited with code ${code}`));
			}
		});

		this.#workers.push(worker);
	}

	/**
	 * Handle worker error by restarting worker and failing pending requests.
	 */
	#handle_worker_error(failed_worker: Worker, error: Error): void {
		// Find and replace the failed worker
		const worker_index = this.#workers.indexOf(failed_worker);
		if (worker_index !== -1) {
			this.#workers[worker_index] = new Worker(this.#worker_script_path);
			this.#create_worker();
		}

		// Reject all pending requests (we can't know which were on the failed worker)
		for (const pending of this.#pending_requests.values()) {
			pending.reject(error);
		}
		this.#pending_requests.clear();

		// Terminate the failed worker
		failed_worker.terminate();
	}

	/**
	 * Parse imports using the worker pool.
	 */
	async parse_imports(
		path_id: Path_Id,
		contents: string,
		ignore_types = true,
	): Promise<Array<string>> {
		if (this.#disposed) {
			throw new Error('Worker pool disposed');
		}

		if (this.#workers.length === 0) {
			throw new Error('No workers available');
		}

		const request_id = `${path_id}-${Date.now()}-${Math.random()}`;
		const worker = this.#get_next_worker();

		const request: Parse_Imports_Request = {
			id: request_id,
			path_id,
			contents,
			ignore_types,
		};

		return new Promise<Array<string>>((resolve, reject) => {
			// Set up timeout
			const timeout = setTimeout(() => {
				this.#pending_requests.delete(request_id);
				reject(new Error(`Worker timeout after ${this.#timeout_ms}ms`));
			}, this.#timeout_ms);

			// Store pending request
			this.#pending_requests.set(request_id, {
				resolve: (result) => {
					clearTimeout(timeout);
					resolve(result);
				},
				reject: (error) => {
					clearTimeout(timeout);
					reject(error);
				},
			});

			// Send to worker
			worker.postMessage(request);
		});
	}

	/**
	 * Parse multiple imports in parallel.
	 */
	async parse_imports_batch(
		requests: Array<{path_id: Path_Id; contents: string; ignore_types?: boolean}>,
	): Promise<Map<Path_Id, Array<string>>> {
		const promises = requests.map(async (req) => {
			const result = await this.parse_imports(req.path_id, req.contents, req.ignore_types ?? true);
			return [req.path_id, result] as const;
		});

		const results = await Promise.allSettled(promises);
		const success_map = new Map<Path_Id, Array<string>>();

		for (const result of results) {
			if (result.status === 'fulfilled') {
				success_map.set(result.value[0], result.value[1]);
			}
		}

		return success_map;
	}

	/**
	 * Get the next worker using round-robin.
	 */
	#get_next_worker(): Worker {
		const worker = this.#workers[this.#next_worker_index];
		this.#next_worker_index = (this.#next_worker_index + 1) % this.#workers.length;
		return worker;
	}

	/**
	 * Clean up all workers.
	 */
	async dispose(): Promise<void> {
		if (this.#disposed) return;
		this.#disposed = true;

		// Reject all pending requests
		for (const pending of this.#pending_requests.values()) {
			pending.reject(new Error('Worker pool disposed'));
		}
		this.#pending_requests.clear();

		// Terminate all workers
		await Promise.all(this.#workers.map((worker) => worker.terminate()));
		this.#workers.length = 0;
	}
}
