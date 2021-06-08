import {createInterface as create_readline_interface} from 'readline';
import {spawn_process} from '@feltcoop/felt/utils/process.js';
import {green, bgBlack, rainbow, cyan, red, yellow} from '@feltcoop/felt/utils/terminal.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import type {Flavored, Result} from '@feltcoop/felt/utils/types.js';

import type {Task} from './task/task.js';
import {load_package_json} from './utils/package_json.js';
import {GIT_DEPLOY_BRANCH} from './build/default_build_config.js';
import type {Filesystem} from './fs/filesystem.js';
import {load_config} from './config/config.js';
import {build_source_directory} from './build/build_source_directory.js';

// publish.task.ts
// - usage: `gro publish patch`
// - forwards args to `npm version`: https://docs.npmjs.com/cli/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

export interface Task_Args {
	_: string[];
	branch?: string;
	dry?: boolean; // run without changing git or npm
	restricted?: string; // if `true`, package is not public
}

export const task: Task<Task_Args> = {
	description: 'bump version, publish to npm, and sync to GitHub',
	dev: false,
	run: async ({fs, args, log, invoke_task, dev}): Promise<void> => {
		const {branch = GIT_DEPLOY_BRANCH, dry = false, restricted = false} = args;
		if (dry) {
			log.info(rainbow('dry run!'));
		}
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}
		const child_task_args = {...args, _: []};

		const [version_increment] = args._;
		validate_version_increment(version_increment);

		// Confirm with the user that we're doing what they expect:
		const publish_context = await confirm_with_user(fs, version_increment, dry, log);

		// Make sure we're on the right branch:
		// TODO see how the deploy task uses git, probably do that instead
		await spawn_process('git', ['fetch', 'origin', branch]);
		await spawn_process('git', ['checkout', branch]);

		// And updated to the latest:
		await spawn_process('git', ['pull']);

		// Build, check, then create the final artifacts:
		const config = await load_config(fs, dev);
		if (config.publish === null) {
			throw Error('config.publish is null, so this package cannot be published');
		}
		await build_source_directory(fs, config, dev, log);
		await invoke_task('check', child_task_args);

		// Bump the version so the package.json is updated before building:
		if (!dry) {
			const npmVersionResult = await spawn_process('npm', ['version', version_increment]);
			if (!npmVersionResult.ok) {
				throw Error('npm version failed: no commits were made: see the error above');
			}
		}

		await invoke_task('build', child_task_args);

		if (dry) {
			log.info({version_increment, publish: config.publish, branch});
			log.info(rainbow('dry run complete!'));
			return;
		}

		await spawn_process('git', ['push']);
		await spawn_process('git', ['push', '--tags']);
		const publish_args = ['publish'];
		if (!publish_context.previous_changelog_version) {
			publish_args.push('--access', restricted ? 'restricted' : 'public');
		}
		const npm_publish_result = await spawn_process('npm', publish_args, {cwd: config.publish});
		if (!npm_publish_result.ok) {
			throw Error('npm publish failed: revert the version commits or run "npm publish" manually');
		}
	},
};

const confirm_with_user = async (
	fs: Filesystem,
	version_increment: string,
	dry: boolean,
	log: Logger,
): Promise<Publish_Context> => {
	const readline = create_readline_interface({input: process.stdin, output: process.stdout});
	return new Promise<Publish_Context>(async (resolve) => {
		const [
			[current_changelog_version, previous_changelog_version],
			current_package_version,
		] = await Promise.all([get_changelog_versions(fs), get_current_package_version(fs)]);

		let errored = false;
		const log_error: Logger['error'] = (...args) => {
			errored = true;
			log.error(...args);
		};

		if (current_changelog_version === current_package_version) {
			log_error(
				red('New changelog version matches old package version.'),
				'Is the changelog updated?',
			);
		}
		if (previous_changelog_version && previous_changelog_version !== current_package_version) {
			log_error(
				red('Old changelog version does not match old package version.'),
				'Is there an unpublished version in the changelog?',
			);
		}

		const publish_context: Publish_Context = {
			current_package_version,
			current_changelog_version,
			previous_changelog_version,
		};

		if (is_standard_version_increment(version_increment)) {
			const result = validate_standard_version_increment_parts(version_increment, publish_context);
			if (!result.ok) {
				log_error(
					red('Failed to validate standard version increment compared to changelog:'),
					result.reason,
				);
			}
		} else {
			errored = true;
			log.warn(
				red(`Unknown version increment "${version_increment}":`),
				'gro supports only major|minor|patch:',
				yellow('please review the following carefully:'),
			);
		}

		const color = errored ? yellow : green;
		log.info(color(version_increment), '← version increment');
		log.info(color(current_changelog_version || '<empty>'), '← new changelog version');
		log.info(color(previous_changelog_version || '<empty>'), '← old changelog version');
		log.info(color(current_package_version), '← old package version');

		const expected_answer = errored ? 'yes!!' : 'y';
		if (errored) {
			log.warn(yellow(`there's an error or uncheckable condition above`));
		}
		readline.question(
			bgBlack(
				`does this look correct? ${
					errored ? red(`if you're sure `) : ''
				}type "${expected_answer}" to proceed`,
			) + ' ',
			(answer) => {
				if (answer.toLowerCase() !== expected_answer.toLowerCase()) {
					log.info('exiting with', cyan('no changes'));
					process.exit();
				}
				log.info(rainbow('proceeding' + (dry ? ' with dry run' : '')));
				readline.close();
				resolve(publish_context);
			},
		);
	});
};

const CHANGELOG_PATH = 'changelog.md';

// TODO document this better
// TODO move where?
// TODO refactor? this code is quick & worky
const get_changelog_versions = async (
	fs: Filesystem,
): Promise<[current_changelog_version: string, previous_changelog_version?: string]> => {
	if (!(await fs.exists(CHANGELOG_PATH))) {
		throw Error(`Publishing requires ${CHANGELOG_PATH} - please create it to continue`);
	}
	const changelog_matcher = /##.+/g;
	const changelog = await fs.read_file(CHANGELOG_PATH, 'utf8');
	const match_current = changelog.match(changelog_matcher);
	if (!match_current) {
		throw Error(`Changelog must have at least one version header, e.g. ## 0.1.0`);
	}
	return match_current.slice(0, 2).map((line) => line.slice(2).trim()) as [
		string,
		string | undefined,
	];
};

// TODO move where?
const get_current_package_version = async (fs: Filesystem): Promise<string> => {
	const pkg = await load_package_json(fs);
	if (!pkg.version || typeof pkg.version !== 'string') {
		throw Error(`Expected package.json to have a valid version: ${pkg.version}`);
	}
	return pkg.version;
};

interface Publish_Context {
	readonly current_package_version: string;
	readonly current_changelog_version: string;
	readonly previous_changelog_version: string | undefined;
}

// TODO probably want to extra to version helpers
type Standard_Version_Increment = 'major' | 'minor' | 'patch';
type Version_Increment = Flavored<string, 'Version_Increment'>;
const validate_version_increment: Validate_Version_Increment = (v) => {
	if (!v || typeof v !== 'string') {
		throw Error(
			`Expected a version increment like one of patch|minor|major, e.g. gro publish patch`,
		);
	}
};
interface Validate_Version_Increment {
	(v: unknown): asserts v is Version_Increment;
}
const is_standard_version_increment = (v: string): v is Standard_Version_Increment =>
	v === 'major' || v === 'minor' || v === 'patch';

const validate_standard_version_increment_parts = (
	version_increment: Standard_Version_Increment,
	{current_changelog_version, current_package_version, previous_changelog_version}: Publish_Context,
): Result<{}, {reason: string}> => {
	const current_package_versionParts = to_version_parts(
		current_package_version,
		'current_package_version',
	);
	if (!current_package_versionParts.ok) {
		return current_package_versionParts;
	}

	const previous_changelog_version_parts =
		previous_changelog_version === undefined
			? null
			: to_version_parts(previous_changelog_version, 'previous_changelog_version');
	if (previous_changelog_version_parts && !previous_changelog_version_parts.ok) {
		return previous_changelog_version_parts;
	}

	const expected_next_version = to_expected_next_version(
		version_increment,
		current_package_versionParts.value,
	);
	if (expected_next_version !== current_changelog_version) {
		return {
			ok: false,
			reason:
				`\n\n${yellow(expected_next_version)} ← expected changelog version\n` +
				`${yellow(current_changelog_version)} ← actual changelog version\n` +
				`${red(version_increment)} ← specified version increment\n`,
		};
	}

	return {ok: true};
};

type Version_Parts = [number, number, number];
const to_version_parts = (
	version: string,
	name: string = 'version',
): Result<{value: Version_Parts}, {reason: string}> => {
	const value = version.split('.').map((v) => Number(v)) as Version_Parts;
	if (!value) {
		return {ok: false, reason: `expected ${name} to match major.minor.patch: ${version}`};
	} else if (value.length !== 3) {
		return {ok: false, reason: `malformed ${name}: ${version}`};
	}
	return {ok: true, value};
};
const to_expected_next_version = (
	version_increment: Standard_Version_Increment,
	[major, minor, patch]: Version_Parts,
) => {
	if (version_increment === 'major') {
		return `${major + 1}.0.0`;
	} else if (version_increment === 'minor') {
		return `${major}.${minor + 1}.0`;
	} else if (version_increment === 'patch') {
		return `${major}.${minor}.${patch + 1}`;
	} else {
		throw new Unreachable_Error(version_increment);
	}
};
