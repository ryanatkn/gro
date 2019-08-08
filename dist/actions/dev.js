const sirv = require('sirv');
const polka = require('polka');
const {resolve} = require('path');

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 8999;

exports.run = (opts = {}) => {
	const host = opts.host || DEFAULT_HOST;
	const port = opts.port || DEFAULT_PORT;
	const dir = resolve(opts.dir || '.');
	console.log('dir', dir);
	const assets = sirv(dir, {
		maxAge: Infinity,
		immutable: true,
	});
	polka()
		.use(assets)
		.listen(port, err => {
			if (err) {
				console.log('err', err);
			} else {
				console.log('listening', host + ':' + port);
			}
		});
};
