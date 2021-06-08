// TODO maybe rename this to `FrontendDevtools`, `ClientDevtools`, or `BrowserDevtools`?
export class Gro_Devtools {
	head: HTMLHeadElement;
	style_elements_by_path: Map<string, HTMLLinkElement> = new Map();

	constructor() {
		this.head = document.getElementsByTagName('head')[0];
	}

	// TODO redesign this completely, this was just the first hack that came to mind
	register_css(path: string) {
		if (this.style_elements_by_path.has(path)) {
			// TODO should this do reference counting and remove unused CSS?
			// if so, we need to have components call `unregister_css`,
			// which could be a function returned from this method
			return;
		}
		const style_el = document.createElement('link');
		this.style_elements_by_path.set(path, style_el);
		style_el.rel = 'stylesheet';
		style_el.href = path;
		this.head.appendChild(style_el);
	}
}
