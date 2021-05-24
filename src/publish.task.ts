import {createInterface as createReadlineInterface} from 'readline';

import type {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {green, bgBlack, rainbow, cyan, red, yellow} from './utils/terminal.js';
import {loadPackageJson} from './utils/packageJson.js';
import type {Logger} from './utils/log.js';
import {GIT_DEPLOY_BRANCH} from './build/defaultBuildConfig.js';
import type {Filesystem} from './fs/filesystem.js';
import {UnreachableError} from './utils/error.js';
import type {Flavored, Result} from './utils/types.js';
import {loadGroConfig} from './config/config.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';

// publish.task.ts
// - usage: `gro publish patch`
// - forwards args to `npm version`: https://docs.npmjs.com/cli/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

export interface TaskArgs {
	_: string[];
	branch?: string;
	dry?: boolean;
}

export const task: Task<TaskArgs> = {
	description: 'bump version, publish to npm, and sync to GitHub',
	dev: false,
	run: async ({fs, args, log, invokeTask, dev}): Promise<void> => {
		const {branch = GIT_DEPLOY_BRANCH, dry = false} = args;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}
		const childTaskArgs = {...args, _: []};

		const versionIncrement = args._[0];
		validateVersionIncrement(versionIncrement);

		// Confirm with the user that we're doing what they expect:
		const publishContext = await confirmWithUser(fs, versionIncrement, log);

		// Make sure we're on the right branch:
		// TODO see how the deploy task uses git, probably do that instead
		await spawnProcess('git', ['fetch', 'origin', branch]);
		await spawnProcess('git', ['checkout', branch]);

		// And updated to the latest:
		await spawnProcess('git', ['pull']);

		// Build, check, then create the final artifacts:
		const config = await loadGroConfig(fs, dev);
		await buildSourceDirectory(fs, config, dev, log);
		await invokeTask('check', childTaskArgs);
		await invokeTask('build', childTaskArgs);

		if (dry) {
			log.info(rainbow('dry run complete!'));
			return;
		}

		const npmVersionResult = await spawnProcess('npm', ['version', versionIncrement]);
		if (!npmVersionResult.ok) {
			throw Error('npm version failed: see the error above');
		}
		await spawnProcess('git', ['push']);
		await spawnProcess('git', ['push', '--tags']);
		const publishArgs = ['publish'];
		if (!publishContext.previousChangelogVersion) {
			publishArgs.push('--access', 'public');
		}
		const npmPublishResult = await spawnProcess('npm', publishArgs);
		if (!npmPublishResult.ok) {
			throw Error('npm publish failed: revert the version commits or run "npm publish" manually');
		}
	},
};

const confirmWithUser = async (
	fs: Filesystem,
	versionIncrement: string,
	log: Logger,
): Promise<PublishContext> => {
	const readline = createReadlineInterface({input: process.stdin, output: process.stdout});
	return new Promise<PublishContext>(async (resolve) => {
		const [
			[currentChangelogVersion, previousChangelogVersion],
			currentPackageVersion,
		] = await Promise.all([getChangelogVersions(fs), getCurrentPackageVersion(fs)]);

		let errored = false;
		const logError: Logger['error'] = (...args) => {
			errored = true;
			log.error(...args);
		};

		if (currentChangelogVersion === currentPackageVersion) {
			logError(
				red('New changelog version matches old package version.'),
				'Is the changelog updated?',
			);
		}
		if (previousChangelogVersion && previousChangelogVersion !== currentPackageVersion) {
			logError(
				red('Old changelog version does not match old package version.'),
				'Is there an unpublished version in the changelog?',
			);
		}

		const publishContext: PublishContext = {
			currentPackageVersion,
			currentChangelogVersion,
			previousChangelogVersion,
		};

		if (isStandardVersionIncrement(versionIncrement)) {
			const result = validateStandardVersionIncrementParts(versionIncrement, publishContext);
			if (!result.ok) {
				logError(
					red('Failed to validate standard version increment compared to changelog:'),
					result.reason,
				);
			}
		} else {
			errored = true;
			log.warn(
				red(`Unknown version increment "${versionIncrement}":`),
				'gro supports only major|minor|patch:',
				yellow('please review the following carefully:'),
			);
		}

		const color = errored ? yellow : green;
		log.info(color(versionIncrement), '← version increment');
		log.info(color(currentChangelogVersion || '<empty>'), '← new changelog version');
		log.info(color(previousChangelogVersion || '<empty>'), '← old changelog version');
		log.info(color(currentPackageVersion), '← old package version');

		const expectedAnswer = errored ? 'yes!!' : 'y';
		if (errored) {
			log.warn(yellow(`there's an error or uncheckable condition above`));
		}
		readline.question(
			bgBlack(
				`does this look correct? ${
					errored ? red(`if you're sure `) : ''
				}type "${expectedAnswer}" to proceed`,
			) + ' ',
			(answer) => {
				if (answer.toLowerCase() !== expectedAnswer.toLowerCase()) {
					log.info('exiting with', cyan('no changes'));
					process.exit();
				}
				log.info(rainbow('proceeding'));
				readline.close();
				resolve(publishContext);
			},
		);
	});
};

const CHANGELOG_PATH = 'changelog.md';

// TODO document this better
// TODO move where?
// TODO refactor? this code is quick & worky
const getChangelogVersions = async (
	fs: Filesystem,
): Promise<[currentChangelogVersion?: string, previousChangelogVersion?: string]> => {
	if (!(await fs.exists(CHANGELOG_PATH))) {
		throw Error(`Publishing requires ${CHANGELOG_PATH} - please create it to continue`);
	}
	const changelogMatcher = /##.+/g;
	const changelog = await fs.readFile(CHANGELOG_PATH, 'utf8');
	const matchCurrent = changelog.match(changelogMatcher);
	if (!matchCurrent) {
		throw Error(`Changelog must have at least one version header, e.g. ## 0.1.0`);
	}
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

interface PublishContext {
	readonly currentPackageVersion: string;
	readonly currentChangelogVersion: string | undefined;
	readonly previousChangelogVersion: string | undefined;
}

// TODO probably want to extra to version helpers
type StandardVersionIncrement = 'major' | 'minor' | 'patch';
type VersionIncrement = Flavored<string, 'VersionIncrement'>;
const validateVersionIncrement: ValidateVersionIncrement = (v) => {
	if (!v || typeof v !== 'string') {
		throw Error(
			`Expected a version increment like one of patch|minor|major, e.g. gro publish patch`,
		);
	}
};
interface ValidateVersionIncrement {
	(v: unknown): asserts v is VersionIncrement;
}
const isStandardVersionIncrement = (v: string): v is StandardVersionIncrement =>
	v === 'major' || v === 'minor' || v === 'patch';

const validateStandardVersionIncrementParts = (
	versionIncrement: StandardVersionIncrement,
	{currentChangelogVersion, currentPackageVersion, previousChangelogVersion}: PublishContext,
): Result<{}, {reason: string}> => {
	const currentPackageVersionParts = toVersionParts(currentPackageVersion, 'currentPackageVersion');
	if (!currentPackageVersionParts.ok) {
		return currentPackageVersionParts;
	}

	const previousChangelogVersionParts =
		previousChangelogVersion === undefined
			? null
			: toVersionParts(previousChangelogVersion, 'previousChangelogVersion');
	if (previousChangelogVersionParts && !previousChangelogVersionParts.ok) {
		return previousChangelogVersionParts;
	}

	const expectedNextVersion = toExpectedNextVersion(
		versionIncrement,
		currentPackageVersionParts.value,
	);
	if (expectedNextVersion !== currentChangelogVersion) {
		return {
			ok: false,
			reason:
				`\n\n${yellow(expectedNextVersion)} ← expected changelog version\n` +
				`${yellow(currentChangelogVersion)} ← actual changelog version\n` +
				`${red(versionIncrement)} ← specified version increment\n`,
		};
	}

	return {ok: true};
};

type VersionParts = [number, number, number];
const toVersionParts = (
	version: string,
	name: string = 'version',
): Result<{value: VersionParts}, {reason: string}> => {
	const value = version.split('.').map((v) => Number(v)) as VersionParts;
	if (!value) {
		return {ok: false, reason: `expected ${name} to match major.minor.patch: ${version}`};
	} else if (value.length !== 3) {
		return {ok: false, reason: `malformed ${name}: ${version}`};
	}
	return {ok: true, value};
};
const toExpectedNextVersion = (
	versionIncrement: StandardVersionIncrement,
	[major, minor, patch]: VersionParts,
) => {
	if (versionIncrement === 'major') {
		return `${major + 1}.0.0`;
	} else if (versionIncrement === 'minor') {
		return `${major}.${minor + 1}.0`;
	} else if (versionIncrement === 'patch') {
		return `${major}.${minor}.${patch + 1}`;
	} else {
		throw new UnreachableError(versionIncrement);
	}
};
