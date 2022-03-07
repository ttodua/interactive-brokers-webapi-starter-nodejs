const os = require ('os');
const fs = require ('fs');
const path = require ('path');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

async function loadIbLocalhost (params = {}) {
	const forceDownload = params.forceDownload || false;
	const defaultUrl    = params.defaultUrl || 'https://download2.interactivebrokers.com/portal/clientportal.gw.zip';
	const showMessages  = params.showMessages || false;
	// https://interactivebrokers.github.io/cpwebapi/
	// At first, download gateway files
	const tempDir = os.tmpdir ();
	const ibkrGatewayDir = path.resolve (tempDir + '/ibrk_cpwa_gateway/');
	const dirExists = fs.existsSync (ibkrGatewayDir);
	if (!dirExists || forceDownload) {
		if (!dirExists) {
			fs.mkdirSync (ibkrGatewayDir);
		}
		const ibrkGatewayZipUrl = defaultUrl;
		const ibkrGatewayZipPath = tempDir + '/ib_cpwa_gateway.zip';
		// download
		const res = await fetch (ibrkGatewayZipUrl);
		const fileStream = fs.createWriteStream (ibkrGatewayZipPath);
		await new Promise ((resolve, reject) => {
			res.body.pipe (fileStream);
			res.body.on ('error', reject);
			fileStream.on ('finish', resolve);
		});
		// extract
		(new AdmZip (ibkrGatewayZipPath)).extractAllTo (ibkrGatewayDir, true); // rewrite 'true'
	}
	// Now, start the server
	const https = require ('https');
	const cp = require ('child_process');
	const baseUrl = 'https://localhost:5000';
	const checkAuthUrl = baseUrl + '/sso/Dispatcher';
	const success_text = 'Client login succeeds';
	const connection_refusal_text = 'connect ECONNREFUSED 127.0.0.1:5000';
	const interval = 60;
	const log = function (txt) {
		console.log ('• [IBKR Localserver] ' + ((new Date ()).toISOString ()) + ' ::: ' + txt);
	};
	const fetchCustom = async function (url) {
		return new Promise ((resolve, reject) => {
			try {
				https.get (url, { 'agent': new https.Agent ({ 'rejectUnauthorized': false }) }, (res) => {
					let body = '';
					res.setEncoding ('utf8');
					res.on ('data', (data) => {
						body += data;
					});
					res.on ('end', () => resolve (body));
					res.on ('error', (e) => {
						// console.log(5);
						reject (e);
					});
				}).on ('error', (ex) => {
					// console.log(6);
					reject (ex);
				});
			} catch (ex) {
				// console.log(8);
				reject (ex);
			}
		}); // .catch( function(ex) { console.log(ex); });
	};
	const start_server = async function () {
		let cmd = '';
		const path = ibkrGatewayDir;
		if (process.platform === 'win32') {
			cmd = '"' + path + '\\bin\\run.bat" "' + path + '\\root\\conf.yaml"';
		} else {
			cmd = '';
		}
		await cp.exec (cmd, (error, stdout, stderr) => {
			console.log ('--------');
			console.log (error);
			console.log (stdout);
			console.log (stderr);
		});
	};
	const checkFunc = async function () {
		try {
			const content = await fetchCustom (checkAuthUrl);
			try {
				const text = content;
				if (text === success_text) {
					log ('authstatus ping ok');
				} else {
					log ('authstatus status (' + text + '; Please authorize yourself at: ' + baseUrl);
				}
			} catch (ex) {
				console.log (ex);
			}
		} catch (ex) {
			try {
				const msg = ex.message;
				if (msg === connection_refusal_text) {
					log ('Error: connection refused, server will be restarted now. ');
					await start_server ();
					setTimeout (checkFunc, 3000);
				} else {
					log ('Error: ' + msg);
				}
			} catch (ex) {
				console.log (ex);
			}
		}
	};
	await checkFunc ();
	setInterval (checkFunc, 1000 * interval);
}

module.exports = loadIbLocalhost;