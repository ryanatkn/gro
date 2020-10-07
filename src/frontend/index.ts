import App from './App.svelte';

const root = document.getElementById('root');
if (!root) throw Error('Cannot find root element');

export const app = new App({
	target: root,
	props: {},
});

(window as any).app = app;
// import './foo.js';
// import 'test-fake-module';
