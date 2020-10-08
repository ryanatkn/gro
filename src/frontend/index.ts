import App from './App.svelte';
import './foo.js';
import {bar} from './bar.js';

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {bar},
});

(window as any).app = app;
