import {outputFile, pathExists, readFile} from '../fs/nodeFs.js';
import {SystemLogger} from '../utils/log.js';
import {cyan} from '../utils/terminal.js';

const log = new SystemLogger([cyan('[state]')]);

export interface GroBuildState {
	port: number;
}

const GRO_STATE_FILE = './.gro/state.json';

export const loadGroBuildState = async (): Promise<GroBuildState | null> => {
	if (!(await pathExists(GRO_STATE_FILE))) return null;
	try {
		return JSON.parse(await readFile(GRO_STATE_FILE, 'utf8'));
	} catch (err) {
		log.error('failed to load build state', GRO_STATE_FILE);
		return null;
	}
};

export const outputGroBuildState = async (state: GroBuildState): Promise<void> => {
	try {
		await outputFile(GRO_STATE_FILE, JSON.stringify(state, null, 2));
	} catch (err) {
		log.error('failed to output build state', GRO_STATE_FILE, state);
	}
};
