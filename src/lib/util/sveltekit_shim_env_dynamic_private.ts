import {DEV} from 'esm-env';
import {loadEnv} from 'vite';

const env = loadEnv(DEV ? 'development' : 'production', '');

console.log(`LOADED VITE env`, env);
