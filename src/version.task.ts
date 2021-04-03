import {createInterface as createReadlineInterface} from 'readline';

import type {Task} from './task/task.js';
import {isThisProjectGro} from './paths.js';
import {spawnProcess} from './utils/process.js';
import {green, bgBlack, rainbow} from './utils/terminal.js';
import {readFile} from './fs/nodeFs.js';
import {loadPackageJson} from './project/packageJson.js';

const rl = createReadlineInterface({input: process.stdin, output: process.stdout});

// version.task.ts
// - usage: `gro version patch`
// - forwards args to `npm version`: https://docs.npmjs.com/cli/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch (TODO configure)
// - syncs commits and tags to GitHub `main` branch

// TODO configure branch
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

export const task: Task = {
	description: 'bump version, publish to npm, and sync to GitHub',
	run: async ({args, log, invokeTask}): Promise<void> => {
		const versionIncrement = args._[0];
		validateVersionIncrement(versionIncrement);
		log.info('new version:', green(versionIncrement));

		await new Promise(async (resolve) => {
			const [latestChangelogVersion, currentPackageVersion] = await Promise.all([
				getLatestChangelogHeading(),
				getCurrentPackageVersion(),
			]);
			log.info('latest changelog version:', green(latestChangelogVersion));
			log.info('current package version:', green(currentPackageVersion));
			if (latestChangelogVersion === currentPackageVersion) {
				throw Error('Changelog version matches package version. Is the changelog updated?');
			}
			rl.question(bgBlack('does this look correct? y/n') + ' ', (answer) => {
				const lowercasedAnswer = answer.toLowerCase();
				if (!(lowercasedAnswer === 'y' || lowercasedAnswer === 'yes')) {
					log.info(green('exiting task with no changes'));
					process.exit();
				}
				log.info(rainbow('proceeding'));
				rl.close();
				resolve(null);
			});
		});

		// Make sure we're on the main branch:
		await spawnProcess('git', ['checkout', 'main']); // TODO allow configuring `'main'`

		// And updated to the latest:
		await spawnProcess('git', ['pull']);

		// Normal user projects will hit this code path right here:
		// in other words, `isThisProjectGro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		// I don't want to touch Gro's prod build pipeline right now using package.json `"preversion"`
		if (!isThisProjectGro) {
			await invokeTask('build');
		}
		await spawnProcess('npm', ['version', ...process.argv.slice(3)]);
		await spawnProcess('npm', ['publish']);
		await spawnProcess('git', ['push']);
		await spawnProcess('git', ['push', '--tags']);
	},
};

// TODO move where?
// TODO refactor? this code is quick & worky
const changelogMatcher = /##(.+)/;
const getLatestChangelogHeading = async (): Promise<string> => {
	const changelog = await readFile('changelog.md', 'utf8');
	const matches = changelog.match(changelogMatcher);
	if (matches) {
		const version = matches[1].trim();
		if (version) return version;
	}
	throw Error('Expected changelog subheading with version: "## 0.0.1"');
};

// TODO move where?
const getCurrentPackageVersion = async (): Promise<string> => {
	const pkg = await loadPackageJson();
	if (!pkg.version || typeof pkg.version !== 'string') {
		throw Error(`Expected package.json to have a valid version: ${pkg.version}`);
	}
	return pkg.version;
};
