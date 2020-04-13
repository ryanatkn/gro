import CheapWatch from 'cheap-watch';

import {gray} from '../../colors/terminal.js';
import {
	TestContext,
	Options as TestContextOptions,
	RequiredOptions as TestContextRequiredOptions,
	initOptions as initTestContextOptions,
} from '../TestContext.js';
import * as report from './report.js';
import {toFileData, FileStats} from '../../files/fileData.js';
import {basePathToBuildId} from '../../paths.js';
import {
	DEBOUNCE_DEFAULT,
	CheapWatchPathAddedEvent,
	CheapWatchPathRemovedEvent,
} from '../../files/nodeFs.js';

export const DEFAULT_TEST_FILE_MATCHER = /.+\.test\.js$/;

// TODO probably rewrite this to implement a `TestHost` and change classes to pojos
export interface Options extends TestContextOptions {
	filter(p: {path: string; stats: FileStats}): boolean; // TODO should filter be on the `TestContext`?
	debounce: number;
}
export type RequiredOptions = TestContextRequiredOptions;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	filter: ({path, stats}) =>
		stats.isDirectory() || DEFAULT_TEST_FILE_MATCHER.test(path),
	debounce: DEBOUNCE_DEFAULT,
	...initTestContextOptions(opts),
});

export class NodeTestContext extends TestContext<Options, InitialOptions> {
	report = report;

	async importTestModule(id: string) {
		return import(id);
	}

	constructor(opts: InitialOptions) {
		super(opts, initOptions);

		// TODO maybe create the logger here and add to options?
		const {filter, debounce} = this.options;
		const {dir, watch} = this;

		this.watcher = new CheapWatch({dir, filter, watch, debounce});
		this.watcher.on('+', this.handlePathAdded);
		this.watcher.on('-', this.handlePathRemoved);
	}

	watcher: CheapWatch;

	handlePathAdded = ({path, stats, isNew}: CheapWatchPathAddedEvent) => {
		this.log.trace('added', gray(path), {stats, isNew});
		throw Error('watch is not implemented - need to update this.paths');
	};
	handlePathRemoved = ({path, stats}: CheapWatchPathRemovedEvent) => {
		this.log.trace('removed', gray(path), {stats});
		throw Error('watch is not implemented - need to update this.paths');
	};

	async start() {
		const {watcher, files} = this;
		await watcher.init();
		for (const [path, stats] of watcher.paths) {
			// TODO need to filter if CheapWatch usage changes to include all files
			// && filter({path, stats})
			if (!stats.isDirectory()) {
				files.set(toFileData(basePathToBuildId(path), stats));
			}
		}
	}

	async stop() {
		this.watcher.close();
	}
}
