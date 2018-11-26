
## Loading and Initializing the Solace Node.js API

To load the Solace Node.js API into your Node.js application simply include the `solclientjs` module.

```javascript
var solace = require('solclientjs');
```

Use the debug version of the API of the `solclientjs` module instead, if you’re planning to see console log messages and/or debug it.

```javascript
var solace = require('solclientjs').debug; // logging is supported here
```

Then initialize the `SolclientFactory`, which is the first entry point to the API. Add the following to initialize with the latest `version10` behavior profile to run with the default property values that Solace recommends at the time of the version 10 release.

```javascript
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);
```

If the debug version of the API has been loaded the required level of logging can be set like so:

```javascript
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
```

