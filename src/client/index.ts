import './devtools.js';
import App from './App.svelte';
import * as fp from 'path';
console.log('fp', fp);
(window as any).fp = fp;

// TODO remove when we have another import from outside `src/client/`
import {mix} from '../utils/math.js';
console.log('mix', mix);

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {},
});

(window as any).app = app;
