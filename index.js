const os = require ('os');
const fs = require ('fs');
const path = require ('path');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

const log = function (txt) {
	console.log ('• [IBKR Localserver] ' + ((new Date ()).toISOString ()) + ' ::: ' + txt);
};

async function loadIbLocalhost (params = {}) {
	let forceDownload = params.forceDownload || false;
	const defaultUrl    = params.defaultUrl || 'https://download2.interactivebrokers.com/portal/clientportal.gw.zip';
	const showMessages  = params.showMessages || false;
	const redownloadDays  = params.redownloadDays || 7;
	// https://interactivebrokers.github.io/cpwebapi/
	// At first, download gateway files
	const tempDir = os.tmpdir ();
	const ibkrGatewayDir = path.resolve (tempDir + '/ibrk_cpwa_gateway/');
	const ibkrGatewayZipPath = tempDir + '/ib_cpwa_gateway.zip';
	const dirExists = fs.existsSync (ibkrGatewayDir);
	const fileExists = fs.existsSync (ibkrGatewayZipPath);
	if (fileExists) {
		const stats = fs.statSync(ibkrGatewayZipPath);
		if (stats.mtime.getTime() < (new Date).getTime() - redownloadDays*24*60*60*1000 ) {
			log(redownloadDays + " days passed after last IBRK gateway download. Redownloading now again");
			forceDownload = true;
		}
	}
	if (!dirExists || forceDownload) {
		if (!dirExists) {
			fs.mkdirSync (ibkrGatewayDir);
		}
		const ibrkGatewayZipUrl = defaultUrl;
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
	const verificationUrls = {
		'dispatcher': { 'url': baseUrl + '/sso/Dispatcher', 'method': 'GET', 'success_text':'Client login succeeds'},
		'tickle'	: { 'url': baseUrl + '/v1/api/tickle', 'method': 'POST', 'success_text':'"ssoExpires"'},
		'validate'	: { 'url': baseUrl + '/v1/portal/sso/validate', 'method': 'POST', 'success_text':'"ssoExpires"'},
		'chosen'    : 'tickle' // tickle or dispatcher
	};': 1, // uncodumented: extend active session ( stated here: https://interactivebrokers.github.io/cpwebapi/ )
	const interval = 60;
	const connection_refusal_text = 'connect ECONNREFUSED';
	const sslDisabledAgent = new https.Agent ({ 'rejectUnauthorized': false });
	
	const start_server = async function () {
		let cmd = '';
		let path = ibkrGatewayDir;
		if (process.platform === 'win32') {
			//path = path.replace(/\\/g,'\\\\');
			cmd = 'cd /d '+path+` && bin\\run.bat root\\conf.yaml`;
		} else {
			cmd = 'cd "'+path+'" && bin\\run.sh root\\conf.yaml';
		}
		await cp.exec (cmd, (error, stdout, stderr) => {
			console.log ('CMD:error');
			console.log (error);
			console.log ('CMD:stdout');
			console.log (stdout);
			console.log ('CMD:stderr');
			console.log (stderr);
		});
	};
	
	const checkFunc = async function () {
		try {
			const chosenEndpoint = verificationUrls [verificationUrls['chosen']];
			const content = await fetch (chosenEndpoint['url'],  {agent: sslDisabledAgent, method: chosenEndpoint['method']}); 
			const compareTextTo = chosenEndpoint['success_text']; 
			const text = await content.text();
			if (text.indexOf(compareTextTo)>-1) {
				log ('authstatus ping ok');
			} else {
				log ('authstatus fail (' + text + '); Please authorize yourself at: ' + baseUrl);
			}
		} catch (ex) {
			try {
				const msg = ex.message;
				if (msg.indexOf(connection_refusal_text)>-1) {
					log ('Error 1: connection refused, server will be restarted now. ');
					await start_server ();
					setTimeout (checkFunc, 3000);
				} else {
					log ('Error 2: ' + msg);
				}
			} catch (ex) {
				const msg = ex.message;
				console.log ('Error 3: ' + msg);
			}
		}
	};
	await checkFunc ();
	setInterval (checkFunc, 1000 * interval);
}

module.exports = {
	serve : loadIbLocalhost
};