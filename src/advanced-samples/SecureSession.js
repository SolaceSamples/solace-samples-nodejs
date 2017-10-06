/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Solace Systems Node.js API
 * Secure Session tutorial - Topic Subscriber
 * Demonstrates subscribing to a topic for direct messages and receiving messages
 */

/*jslint es6 node:true devel:true*/

var TopicSubscriber = function (solaceModule, topicName) {
    'use strict';
    var solace = solaceModule;
    var subscriber = {};
    subscriber.session = null;
    subscriber.topicName = topicName;
    subscriber.subscribed = false;

    // Logger
    subscriber.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    subscriber.log('\n*** Secure Subscriber to topic "' + subscriber.topicName + '" is ready to connect ***');

    // main function
    subscriber.run = function (argv) {
        if (argv.length >= (2 + 4)) { // expecting 4 real arguments
            subscriber.connect(argv.slice(2)[0], argv.slice(3)[0], argv.slice(4)[0], argv.slice(5)[0]);
        } else {
            subscriber.log('Cannot connect: expecting all arguments' +
                ' <host:port> <client-username> <client-password> <message-vpn>.');
        }
    };

    // Establishes connection to Solace message router
    subscriber.connect = function (host, username, password, vpn) {
        if (subscriber.session !== null) {
            subscriber.log('Already connected and ready to subscribe.');
        } else {
            subscriber.connectToSolace(host, username, password, vpn);
        }
    };

  subscriber.res = function (arg) {
    const { resolve } = require('path');
    return resolve(__dirname, '.', arg);
  }

  subscriber.connectToSolace = function (host, username, password, vpn) {
        const sessionProperties = new solace.SessionProperties();
        sessionProperties.url = 'wss://' + host;
        subscriber.log('Connecting to Solace message router using Secure WebSocket transport url wss://' + host);
        sessionProperties.vpnName = vpn;
        subscriber.log('Solace message router VPN name: ' + sessionProperties.vpnName);
        sessionProperties.userName = username;
        subscriber.log('Client username: ' + sessionProperties.userName);
        sessionProperties.password = password;
        // secure session related session properties
        sessionProperties.authenticationScheme = solace.AuthenticationScheme.CLIENT_CERTIFICATE;
        sessionProperties.sslExcludedProtocols = ['TLSv1'];
        sessionProperties.sslCipherSuites = 'AES128-GCM-SHA256';
        sessionProperties.sslValidateCertificate = true;
        sessionProperties.sslTrustStores = [subscriber.res('certs/root_ca-rsa.crt')];
        sessionProperties.sslTrustedCommonNameList = ['TestServerCN'];
        // listed for completeness but cannot be used at the same time as
        // sessionProperties.sslPfx = res('./client_certificates/client-rsa.pfx');
        // sessionProperties.sslPfxPassword = 'pfx_password';
        sessionProperties.sslPrivateKey = subscriber.res('certs/client1-rsa-1.key');
        sessionProperties.sslPrivateKeyPassword = 'key_password';
        sessionProperties.sslCertificate = subscriber.res('certs/client1-rsa-1.crt');
        // create session
        subscriber.session = solace.SolclientFactory.createSession(sessionProperties);
        // define session event listeners
        subscriber.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            subscriber.log('=== Successfully connected and ready to subscribe. ===');
            subscriber.subscribe();
        });
        subscriber.session.on(solace.SessionEventCode.CONNECTING, function (sessionEvent) {
            subscriber.log('Connecting...');
            subscriber.subscribed = false;
        });
        subscriber.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            subscriber.log('Disconnected.');
            subscriber.subscribed = false;
            if (subscriber.session !== null) {
                subscriber.session.dispose();
                subscriber.session = null;
            }
        });
        subscriber.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, function (sessionEvent) {
            subscriber.log('Cannot subscribe to topic: ' + sessionEvent.correlationKey);
        });
        subscriber.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, function (sessionEvent) {
            if (subscriber.subscribed) {
                subscriber.subscribed = false;
                subscriber.log('Successfully unsubscribed from topic: ' + sessionEvent.correlationKey);
            } else {
                subscriber.subscribed = true;
                subscriber.log('Successfully subscribed to topic: ' + sessionEvent.correlationKey);
                subscriber.log('=== Ready to receive messages. ===');
            }
        });
        // define message event listener
        subscriber.session.on(solace.SessionEventCode.MESSAGE, (message) => {
            subscriber.log('Received message: "' + message.getBinaryAttachment() + '", details:\n' + message.dump());
        });
        // connect the session
        try {
            subscriber.session.connect();
        } catch (error) {
            subscriber.log(error.toString());
        }
    };

    // Subscribes to topic on Solace message router
    subscriber.subscribe = function () {
        if (subscriber.session !== null) {
            if (subscriber.subscribed) {
                subscriber.log('Already subscribed to "' + subscriber.topicName + '" and ready to receive messages.');
            } else {
                subscriber.log('Subscribing to topic: ' + subscriber.topicName);
                try {
                    subscriber.session.subscribe(
                        solace.SolclientFactory.createTopic(subscriber.topicName),
                        true, // generate confirmation when subscription is added successfully
                        subscriber.topicName, // use topic name as correlation key
                        10000 // 10 seconds timeout for this operation
                    );
                } catch (error) {
                    subscriber.log(error.toString());
                }
            }
        } else {
            subscriber.log('Cannot subscribe because not connected to Solace message router.');
        }
    };

    subscriber.exit = function () {
        subscriber.unsubscribe();
        subscriber.disconnect();
        setTimeout(function () {
            process.exit();
        }, 1000); // wait for 1 second to finish
    };

    // Unsubscribes from topic on Solace message router
    subscriber.unsubscribe = function () {
        if (subscriber.session !== null) {
            if (subscriber.subscribed) {
                subscriber.log('Unsubscribing from topic: ' + subscriber.topicName);
                try {
                    subscriber.session.unsubscribe(
                        solace.SolclientFactory.createTopic(subscriber.topicName),
                        true, // generate confirmation when subscription is removed successfully
                        subscriber.topicName, // use topic name as correlation key
                        10000 // 10 seconds timeout for this operation
                    );
                } catch (error) {
                    subscriber.log(error.toString());
                }
            } else {
                subscriber.log('Cannot unsubscribe because not subscribed to the topic "' + subscriber.topicName + '"');
            }
        } else {
            subscriber.log('Cannot unsubscribe because not connected to Solace message router.');
        }
    };

    // Gracefully disconnects from Solace message router
    subscriber.disconnect = function () {
        subscriber.log('Disconnecting from Solace message router...');
        if (subscriber.session !== null) {
            try {
                subscriber.session.disconnect();
            } catch (error) {
                subscriber.log(error.toString());
            }
        } else {
            subscriber.log('Not connected to Solace message router.');
        }
    };

    return subscriber;
};

var solace = require('solclientjs').debug; // logging supported

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the subscriber, specifying the name of the subscription topic
var subscriber = new TopicSubscriber(solace, 'tutorial/topic');

// subscribe to messages on Solace message router
subscriber.run(process.argv);

// wait to be told to exit
subscriber.log("Press Ctrl-C to exit");
process.stdin.resume();

process.on('SIGINT', function () {
    'use strict';
    subscriber.exit();
});
