This [nodejs module](https://www.npmjs.com/package/ibkr-webapi-bridge) is just a wrapper for [IBRK web-api](https://interactivebrokers.github.io/cpwebapi/) Java localhost server, so, you don't have to manually download that. This module automatically downloads that .zip file, extracts and starts that IBKR headless gateway (localhost server) for you. Moreover, this module automatically pings the server once in every minute to keep is alive (as it's required by IBKR).

# Install
`npm i ibkr-webapi-bridge`

# Quick-Run
To run out-of-the-box, after installation, execute: `npm run serve`.

# Examples
You can use in your scripts:
```
const ibBridge = require ('ibkr-webapi-bridge');
ib.serve();
### OR ###
let params = {
    // forceDownload: bool (default: false)
    // defaultUrl: string (default: 'https://download2.interactivebrokers.com/portal/clientportal.gw.zip')
    // redownloadDays: int (default: 7)
    // showMessages: bool (default: false)
};
ib.serve(params);
```
____
Btw, we hope that IBRK will ever drop the obsolete beaurecracy and nonstandard 90's approachs, and will implement a real REST api server (with API keys, as all normal services do) and you will no longer need to use this module. 

