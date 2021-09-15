import './devtools.js';
import App from './App.svelte';
import './testImports/testImports.js';

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {},
});

(window as any).app = app;
