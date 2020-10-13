// TODO maybe rename this to `FrontendDevtools`, `ClientDevtools`, or `BrowserDevtools`?
export class GroDevtools {
	head: HTMLHeadElement;

	constructor() {
		this.head = document.getElementsByTagName('head')[0];
	}

	styleElementsByPath: Map<string, HTMLLinkElement> = new Map();

	registerCss(path: string) {
		if (this.styleElementsByPath.has(path)) {
			// TODO handle this properly
			return;
		}
		const styleEl = document.createElement('link');
		this.styleElementsByPath.set(path, styleEl);
		styleEl.rel = 'stylesheet';
		styleEl.href = path;
		this.head.appendChild(styleEl);
	}
}
