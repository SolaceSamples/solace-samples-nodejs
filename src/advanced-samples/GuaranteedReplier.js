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
 * Guaranteed Request/Reply tutorial - Guaranteed Replier
 * Demonstrates how to receive a request message and responds
 * to it by sending a guaranteed reply message.
 */

/*jslint es6 devel:true node:true*/

var GuaranteedReplier = function (solaceModule, requestQueueName) {
    'use strict';
    var solace = solaceModule;
    var replier = {};
    replier.session = null;
    replier.flow = null;
    replier.requestQueueName = requestQueueName;
    replier.active = false;

    // Logger
    replier.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2), ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    replier.log('\n*** replier to request queue "' + replier.requestQueueName + '" is ready to connect ***');

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
            replier.log('=== Successfully connected and ready to subscribe to request queue. ===');
            replier.startService();
        });
        replier.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            replier.log('Disconnected.');
            replier.active = false;
            if (replier.session !== null) {
                replier.session.dispose();
                replier.session = null;
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
    replier.startService = function () {
        if (replier.session !== null) {
            if (replier.active) {
                replier.log('Replier already connected to "' + replier.requestQueueName + '" and ready to receive' +
                    ' messages.');
            } else {
                replier.log('Replier connecting to request queue: ' + replier.requestQueueName);
                try {
                    var destination = new solace.Destination(replier.requestQueueName, solace.DestinationType.QUEUE);
                    replier.flow = replier.session.createSubscriberFlow({
                        endpoint: {destination, durable: solace.EndpointDurability.DURABLE},
                    });
                    replier.flow.on(solace.FlowEventName.MESSAGE, function onMessage(message) {
                        replier.reply(message);
                    });
                    replier.flow.connect();
                    replier.active = true;
                } catch (error) {
                    replier.log(error.toString());
                }
            }
        } else {
            replier.log('Cannot start replier because not connected to Solace message router.');
        }
    };

    replier.reply = function (message) {
        replier.log('Received request: "' + message.getBinaryAttachment() + '", details:\n' + message.dump());
        replier.log('Replying...');
        if (replier.session !== null) {
            try {
                var replyMsg = solace.SolclientFactory.createMessage();
                var replyText = message.getBinaryAttachment() + " - Sample Reply";
                replyMsg.setBinaryAttachment(replyText);
                replyMsg.setDestination(message.getReplyTo());
                replyMsg.setCorrelationId(message.getCorrelationId());
                replyMsg.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
                replier.session.send(replyMsg);
            } catch (error) {
                console.log('Failed to send reply ');
                console.log(error.toString());
            }
            replier.log('Replied.');
        } else {
            replier.log('Cannot reply: not connected to Solace message router.');
        }
    };

    replier.exit = function () {
        replier.stopService();
        replier.disconnect();
        setTimeout(function () {
            process.exit();
        }, 2000); // wait for 2 seconds to finish
    };

    // Stops the replier service on Solace message router
    replier.stopService = function () {
        if (replier.session !== null) {
            if (replier.active) {
                replier.active = false;
                replier.log('Disconnecting from request queue: ' + replier.requestQueueName);
                try {
                    replier.flow.disconnect();
                    replier.flow.dispose();
                } catch (error) {
                    replier.log(error.toString());
                }
            } else {
                replier.log('Cannot stop replier because it is not connected to request queue "' +
                    replier.requestQueueName + '"');
            }
        } else {
            replier.log('Cannot stop replier because not connected to Solace message router.');
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
var replier = new GuaranteedReplier(solace, 'tutorial/requestqueue');

// reply to messages on Solace message router
replier.run(process.argv);

// wait to be told to exit
replier.log("Press Ctrl-C to exit");
process.stdin.resume();

process.on('SIGINT', function () {
    'use strict';
    replier.exit();
});
