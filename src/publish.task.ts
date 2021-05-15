import {createInterface as createReadlineInterface} from 'readline';

import type {Task} from './task/task.js';
import {isThisProjectGro} from './paths.js';
import {spawnProcess} from './utils/process.js';
import {green, bgBlack, rainbow, red} from './utils/terminal.js';
import {loadPackageJson} from './utils/packageJson.js';
import type {Logger} from './utils/log.js';
import {GIT_DEPLOY_BRANCH} from './config/defaultBuildConfig.js';
import type {Filesystem} from './fs/filesystem.js';

// version.task.ts
// - usage: `gro version patch`
// - forwards args to `npm version`: https://docs.npmjs.com/cli/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

// TODO add `dry` option so it can be tested

type VersionIncrement = string;
const validateVersionIncrement: ValidateVersionIncrement = (v) => {
	if (!v || typeof v !== 'string') {
		throw Error(
			`Expected a version increment like one of patch|minor|major, e.g. gro version patch`,
		);
	}
};
interface ValidateVersionIncrement {
	(v: unknown): asserts v is VersionIncrement;
}

export interface TaskArgs {
	_: string[];
	branch?: string;
}

export const task: Task<TaskArgs> = {
	description: 'bump version, publish to npm, and sync to GitHub',
	run: async ({fs, args, log, invokeTask}): Promise<void> => {
		const {branch = GIT_DEPLOY_BRANCH} = args;

		const versionIncrement = args._[0];
		validateVersionIncrement(versionIncrement);

		// Confirm with the user that we're doing what they expect.
		await confirmWithUser(fs, versionIncrement, log);

		// Make sure we're on the right branch:
		await spawnProcess('git', ['checkout', branch]);

		// And updated to the latest:
		await spawnProcess('git', ['pull']);

		// Normal user projects will hit this code path right here:
		// in other words, `isThisProjectGro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		// I don't want to touch Gro's prod build pipeline right now using package.json `"preversion"`
		if (!isThisProjectGro) {
			await invokeTask('check');
			await invokeTask('build');
		}
		await spawnProcess('npm', ['version', ...process.argv.slice(3)]);
		await spawnProcess('npm', ['publish']);
		await spawnProcess('git', ['push']);
		await spawnProcess('git', ['push', '--tags']);
	},
};

const confirmWithUser = async (
	fs: Filesystem,
	versionIncrement: string,
	log: Logger,
): Promise<void> => {
	const readline = createReadlineInterface({input: process.stdin, output: process.stdout});
	log.info(green(versionIncrement), '← new version');
	await new Promise<void>(async (resolve) => {
		const [
			[currentChangelogVersion, previousChangelogVersion],
			currentPackageVersion,
		] = await Promise.all([getChangelogVersions(fs), getCurrentPackageVersion(fs)]);
		log.info(green(currentChangelogVersion || '<empty>'), '← current changelog version');
		log.info(green(currentPackageVersion), '← current package version');
		log.info(green(previousChangelogVersion || '<empty>'), '← previous changelog version');
		if (currentChangelogVersion === currentPackageVersion) {
			log.error(
				red('Current changelog version matches package version. Is the changelog updated?'),
			);
		}
		if (previousChangelogVersion !== currentPackageVersion) {
			log.error(
				red(
					'Previous changelog version does not match package version.' +
						' Is there an unpublished version in the changelog?',
				),
			);
		}
		readline.question(bgBlack('does this look correct? y/n') + ' ', (answer) => {
			const lowercasedAnswer = answer.toLowerCase();
			if (!(lowercasedAnswer === 'y' || lowercasedAnswer === 'yes')) {
				log.info(green('exiting task with no changes'));
				process.exit();
			}
			log.info(rainbow('proceeding'));
			readline.close();
			resolve();
		});
	});
};

// TODO document this better
// TODO move where?
// TODO refactor? this code is quick & worky
const getChangelogVersions = async (
	fs: Filesystem,
): Promise<[currentChangelogVersion?: string, previousChangelogVersion?: string]> => {
	const changelogMatcher = /##.+/g;
	const changelog = await fs.readFile('changelog.md', 'utf8');
	const matchCurrent = changelog.match(changelogMatcher);
	if (!matchCurrent) return [];
	return matchCurrent.slice(0, 2).map((line) => line.slice(2).trim()) as [string, string];
};

// TODO move where?
const getCurrentPackageVersion = async (fs: Filesystem): Promise<string> => {
	const pkg = await loadPackageJson(fs);
	if (!pkg.version || typeof pkg.version !== 'string') {
		throw Error(`Expected package.json to have a valid version: ${pkg.version}`);
	}
	return pkg.version;
};
