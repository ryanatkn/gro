import {Gen} from '../gen.js';
import {renderNoscriptSection, renderMetaTags} from '../helpers/html.js';

export const gen: Gen = () => {
	const title = 'gro';
	const sourceCodeUrl = 'https://github.com/feltcoop/gro';
	// TODO get the `sourceCodeUrl` from gen context param?
	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<title>${title}</title>
		${renderMetaTags()}
		<link rel="shortcut icon" href="/favicon.ico" />
		<link rel="stylesheet" href="styles.css" />
	</head>
	<body>
		<div id="root">
			${renderNoscriptSection(sourceCodeUrl)}
		</div>
		<script src="index.js" type="module"></script>
	</body>
</html>
`;
};
