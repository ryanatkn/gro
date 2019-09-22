import {gray} from 'kleur';
import * as CheapWatchFIXME from 'cheap-watch';
import {Stats} from 'fs';

import {
	TestContext,
	Options as TestContextOptions,
	RequiredOptions as TestContextRequiredOptions,
	initOptions as initTestContextOptions,
} from '../TestContext';
import * as report from './report';
import {toFileData, FileStats} from '../../build/fileData';
import {basePathToBuildId} from '../../paths';

// TODO probably rewrite this to implement a `TestHost` and change classes to pojos

// TODO bleh I don't wanna use synthetic imports :X
// is this fixed with `--experimental-modules`?
type CheapWatch = CheapWatchFIXME.default;
const CheapWatch: typeof CheapWatchFIXME.default = CheapWatchFIXME as any;

export interface Options extends TestContextOptions {
	filter(p: {path: string; stats: FileStats}): boolean;
	debounce: number;
}
export type RequiredOptions = TestContextRequiredOptions;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	filter: ({path, stats}) =>
		stats.isDirectory() ? true : path.endsWith('.test.js'),
	debounce: 10,
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
		const {
			watcher,
			files,
			options: {filter},
		} = this;
		await watcher.init();
		for (const [path, stats] of watcher.paths) {
			if (!stats.isDirectory() && filter({path, stats})) {
				files.set(toFileData(basePathToBuildId(path), stats));
			}
		}
	}

	async stop() {
		this.watcher.close();
	}
}

interface CheapWatchPathAddedEvent {
	path: string;
	stats: Stats;
	isNew: boolean;
}

interface CheapWatchPathRemovedEvent {
	path: string;
	stats: Stats;
}
