import './devtools.js';
import App from './App.svelte';
import './foo.js';
import {bar} from './bar.js';

// test fully qualified import
import * as motion from 'svelte/motion/index.js';
console.log('imported svelte motion', motion);

// test dynamic import
import('svelte/store').then((store) => {
	console.log('imported svelte/store', store);
});

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {bar},
});

(window as any).app = app;
