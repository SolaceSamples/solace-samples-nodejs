# Getting Started Examples

## Solace Node.js API

These tutorials will get you up to speed and sending messages with Solace technology as quickly as possible. There are two ways you can get started:

- If your company has Solace message routers deployed, contact your middleware team to obtain the host name or IP address of a Solace message router to test against, a username and password to access it, and a VPN in which you can produce and consume messages.
- If you do not have access to a Solace message router, you will need to go through the “[Set up a VMR](http://docs.solace.com/Solace-VMR-Set-Up/Setting-Up-VMRs.htm)” tutorial to download and install the software.

## Contents

This repository contains:

* Tutorials: code and matching tutorial walk throughs for five different **basic** Solace messaging patterns. For a nice introduction to the Solace API and associated tutorials, check out the [tutorials home page](https://solacesamples.github.io/solace-samples-nodejs/).
* Additional code: showing how to make use of **advanced** features of the Solace message-router is available in the [advanced-samples directory](https://github.com/SolaceSamples/solace-samples-nodejs/tree/master/src/advanced-samples). For details about the Solace API, refer to the [Customer Documentation - Developer Guide](http://docs.solace.com/Solace-Messaging-APIs/Developer-Guide/Developer-Guide-Home.htm).

## Checking out

To check out the project, clone this GitHub repository:

```
git clone https://github.com/SolaceSamples/solace-samples-nodejs
cd solace-samples-nodejs
```
 
### Download the Solace JavaScript API

These samples depend on version 10 or later of the Solace Node.js API library.

**Temporary until release:**

The library can be [downloaded here](http://dev.solace.com/downloads/).  The instructions in this tutorial assume you have downloaded the Web Messaging API for Node.js API library and unpacked it to a known location.

For a local installation of the API package, run from the current repository root directory:

```
npm install <path_to_tarball_directory>/node-solclientjs-<version>.tar.gz 
```

**After release (API package v10 will be available from npmjs)**

The library can be installed from the `npmjs` central repository.

For a local installation of the API package, run from the current repository root directory:

```
npm install solclientjs@">=10.0.0"
```

## Running the Samples

The samples are found in the `src/basic-samples` and `src/advanced-samples` directories.

You run the sample using node. For example:

    node TopicPublisher.js <protocol://host:port> <client-username>@<message-vpn> <client-password>

See the [tutorials](https://solacesamples.github.io/solace-samples-nodejs/) for more details.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Authors

See the list of [contributors](https://github.com/SolaceSamples/solace-samples-template/contributors) who participated in this project.

## License

This project is licensed under the Apache License, Version 2.0. - See the [LICENSE](LICENSE) file for details.

## Resources

For more information try these resources:

- The Solace Developer Portal website at: http://dev.solace.com
- Get a better understanding of [Solace technology](http://dev.solace.com/tech/).
- Check out the [Solace blog](http://dev.solace.com/blog/) for other interesting discussions around Solace technology
- Ask the [Solace community.](http://dev.solace.com/community/)
