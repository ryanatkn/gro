// TODO maybe rename this to `FrontendDevtools`, `ClientDevtools`, or `BrowserDevtools`?
export class GroDevtools {
	head: HTMLHeadElement;
	styleElementsByPath: Map<string, HTMLLinkElement> = new Map();

	constructor() {
		this.head = document.getElementsByTagName('head')[0];
	}

	// TODO redesign this completely, this was just the first hack that came to mind
	registerCss(path: string) {
		if (this.styleElementsByPath.has(path)) {
			// TODO should this do reference counting and remove unused CSS?
			// if so, we need to have components call `unregisterCss`,
			// which could be a function returned from this method
			return;
		}
		const styleEl = document.createElement('link');
		this.styleElementsByPath.set(path, styleEl);
		styleEl.rel = 'stylesheet';
		styleEl.href = path;
		this.head.appendChild(styleEl);
	}
}
