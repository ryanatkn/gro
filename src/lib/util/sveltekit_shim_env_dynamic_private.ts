// shim for $env/dynamic/private
// @see https://github.com/sveltejs/kit/issues/1485

import {loadEnv} from 'vite';
import {stripEnd} from '@feltjs/util/string.js';

import {paths} from '../path/paths.js';

console.log(`loading paths.root`, stripEnd(paths.root, '/'));
const env = loadEnv('development', stripEnd(paths.root, '/'), '');

console.log(`LOADED VITE env`, env);
