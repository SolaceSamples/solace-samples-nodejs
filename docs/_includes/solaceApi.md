
## Obtaining the Solace API

This tutorial depends on you having the Solace Systems Node.js API downloaded and available. The Solace Systems Node.js API distribution package can be [downloaded here]({{ site.links-downloads }}){:target="_top"}. The Node.js API is distributed as a zip file containing the required JavaScript files, API documentation, and examples. The instructions in this tutorial assume you have downloaded the Node.js API library and unpacked it to a known location.

## Loading Solace Systems Node.js API

To load the Solace Systems Node.js API into your Node.js application simply include the `lib/solclientjs` module from the distribution.

```javascript
var solace = require('./lib/solclientjs');
```

Use the debug version of the API in `lib/solclient-debug` module instead, if you’re planning to see console log messages and/or debug it.

```javascript
var solace = require('./lib/solclient-debug');
```

If the debug version is used, it is necessary to initialize solace.SolclientFactory with required level of logging like so:

```javascript
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.logLevel = solace.LogLevel.WARN;
solace.SolclientFactory.init(factoryProps);
```