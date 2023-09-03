// shim for $env/dynamic/private
// @see https://github.com/sveltejs/kit/issues/1485

import {loadEnv} from 'vite';

import {paths} from '../path/paths.js';

console.log(`loading paths.root`, paths.root);
const env = loadEnv('development', paths.root, '');

console.log(`LOADED VITE env`, env);
