import App from './App.svelte';
import './foo.js';
import {bar} from './bar.js';

// test fully qualified import
import * as motion from 'svelte/motion/index.js';
console.log('svelte motion', motion);

// test dynamic import
import('svelte/store').then((storeModule) => {
	console.log('imported svelte/store', storeModule);
});

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {bar},
});

(window as any).app = app;
