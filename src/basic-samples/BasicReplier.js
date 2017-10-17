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
 * RequestReply tutorial - Basic Replier
 * Demonstrates sending a request and receiving a reply
 */

/*jslint es6 devel:true node:true*/

var BasicReplier = function (solaceModule, topicName) {
    'use strict';
    var solace = solaceModule;
    var replier = {};
    replier.session = null;
    replier.topicName = topicName;
    replier.subscribed = false;

    // Logger
    replier.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2), ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    replier.log('\n*** replier to topic "' + replier.topicName + '" is ready to connect ***');

    // main function
    replier.run = function (argv) {
        if (argv.length >= (2 + 4)) { // expecting 4 real arguments
            replier.connect(argv.slice(2)[0], argv.slice(3)[0], argv.slice(4)[0], argv.slice(5)[0]);
        } else {
            replier.log('Cannot connect: expecting all arguments' +
                ' <host:port> <client-username> <client-password> <message-vpn>.');
        }
    };

    // Establishes connection to Solace message router
    replier.connect = function (host, username, password, vpn) {
        if (replier.session !== null) {
            replier.log('Already connected and ready to subscribe to request topic.');
        } else {
            replier.connectToSolace(host, username, password, vpn);
        }
    };

    replier.connectToSolace = function (host, username, password, vpn) {
        const sessionProperties = new solace.SessionProperties();
        sessionProperties.url = 'ws://' + host;
        replier.log('Connecting to Solace message router using WebSocket transport url ws://' + host);
        sessionProperties.vpnName = vpn;
        replier.log('Solace message router VPN name: ' + sessionProperties.vpnName);
        sessionProperties.userName = username;
        replier.log('Client username: ' + sessionProperties.userName);
        sessionProperties.password = password;
        // create session
        replier.session = solace.SolclientFactory.createSession(sessionProperties);
        // define session event listeners
        replier.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            replier.log('=== Successfully connected and ready to subscribe to request topic. ===');
            replier.subscribe();
        });
        replier.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            replier.log('Disconnected.');
            replier.subscribed = false;
            if (replier.session !== null) {
                replier.session.dispose();
                replier.session = null;
            }
        });
        replier.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, function (sessionEvent) {
            replier.log('Cannot subscribe to topic: ' + sessionEvent.correlationKey);
        });
        replier.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, function (sessionEvent) {
            if (replier.subscribed) {
                replier.subscribed = false;
                replier.log('Successfully unsubscribed from request topic: ' + sessionEvent.correlationKey);
            } else {
                replier.subscribed = true;
                replier.log('Successfully subscribed to request topic: ' + sessionEvent.correlationKey);
                replier.log('=== Ready to receive requests. ===');
            }
        });
        // define message event listener
        replier.session.on(solace.SessionEventCode.MESSAGE, (message) => {
            try {
                replier.reply(message);
            } catch (error) {
                replier.log(error.toString());
            }
        });
        // connect the session
        try {
            replier.session.connect();
        } catch (error) {
            replier.log(error.toString());
        }
    };

    // Subscribes to request topic on Solace message router
    replier.subscribe = function () {
        if (replier.session !== null) {
            if (replier.subscribed) {
                replier.log('Already subscribed to "' + replier.topicName + '" and ready to receive messages.');
            } else {
                replier.log('Subscribing to topic: ' + replier.topicName);
                try {
                    replier.session.subscribe(
                        solace.SolclientFactory.createTopic(replier.topicName),
                        true, // generate confirmation when subscription is added successfully
                        replier.topicName, // use topic name as correlation key
                        10000 // 10 seconds timeout for this operation
                    );
                } catch (error) {
                    replier.log(error.toString());
                }
            }
        } else {
            replier.log('Cannot subscribe because not connected to Solace message router.');
        }
    };

    // Unsubscribes from request topic on Solace message router
    replier.unsubscribe = function () {
        if (replier.session !== null) {
            if (replier.subscribed) {
                replier.log('Unsubscribing from topic: ' + replier.topicName);
                try {
                    replier.session.unsubscribe(
                        solace.SolclientFactory.createTopic(replier.topicName),
                        true, // generate confirmation when subscription is removed successfully
                        replier.topicName, // use topic name as correlation key
                        10000 // 10 seconds timeout for this operation
                    );
                } catch (error) {
                    replier.log(error.toString());
                }
            } else {
                replier.log('Cannot unsubscribe because not subscribed to the topic "' + replier.topicName + '"');
            }
        } else {
            replier.log('Cannot unsubscribe because not connected to Solace message router.');
        }
    };

    replier.reply = function (message) {
        replier.log('Received message: "' + message.getSdtContainer().getValue() + '", details:\n' + message.dump());
        replier.log('Replying...');
        if (replier.session !== null) {
            var reply = solace.SolclientFactory.createMessage();
            var replyText = message.getSdtContainer().getValue() + " - Sample Reply";
            reply.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, replyText));
            replier.session.sendReply(message, reply);
            replier.log('Replied.');
        } else {
            replier.log('Cannot reply: not connected to Solace message router.');
        }
    };

    // Gracefully disconnects from Solace message router
    replier.disconnect = function () {
        replier.log('Disconnecting from Solace message router...');
        if (replier.session !== null) {
            try {
                replier.session.disconnect();
                replier.session.dispose();
                replier.session = null;
            } catch (error) {
                replier.log(error.toString());
            }
        } else {
            replier.log('Not connected to Solace message router.');
        }
    };

    replier.exit = function () {
        replier.unsubscribe();
        setTimeout(function () {
            replier.disconnect();
        }, 1000); // wait for 1 second to disconnect
        setTimeout(function () {
            process.exit();
        }, 2000); // wait for 2 seconds to finish
    };

    return replier;
};

var solace = require('solclientjs').debug; // logging supported

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the replier, specifying the name of the request topic
var replier = new BasicReplier(solace, 'tutorial/topic');

// reply to messages on Solace message router
replier.run(process.argv);

// wait to be told to exit
replier.log("Press Ctrl-C to exit");
process.stdin.resume();

process.on('SIGINT', function () {
    'use strict';
    replier.exit();
});
