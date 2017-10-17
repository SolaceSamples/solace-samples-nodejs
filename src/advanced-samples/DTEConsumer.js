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
 * Durable Topic Endpoint Subscriber tutorial - DTE Consumer
 * Demonstrates receiving persistent messages from a DTE
 */

/*jslint es6 node:true devel:true*/

var DTEConsumer = function (solaceModule, topicEndpointName, topicName) {
    'use strict';
    var solace = solaceModule;
    var consumer = {};
    consumer.session = null;
    consumer.flow = null;
    consumer.topicEndpointName = topicEndpointName;
    consumer.topicName = topicName;
    consumer.topicDestination = new solace.Destination(consumer.topicName, solace.DestinationType.TOPIC);
    consumer.consuming = false;

    // Logger
    consumer.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    consumer.log('\n*** Consumer to DTE "' + consumer.topicEndpointName + '" is ready to connect ***');

    // main function
    consumer.run = function (argv) {
        consumer.connect(argv);
    };

    // Establishes connection to Solace message router
    consumer.connect = function (argv) {
        if (consumer.session !== null) {
            consumer.log('Already connected and ready to consume messages.');
        } else {
            if (argv.length >= (2 + 4)) { // expecting 4 real arguments
                consumer.connectToSolace(argv.slice(2)[0], argv.slice(3)[0], argv.slice(4)[0], argv.slice(5)[0]);
            } else {
                consumer.log('Cannot connect: expecting all arguments' +
                    ' <host:port> <client-username> <client-password> <message-vpn>.');
            }
        }
    };

    consumer.connectToSolace = function (host, username, password, vpn) {
        const sessionProperties = new solace.SessionProperties();
        sessionProperties.url = 'ws://' + host;
        consumer.log('Connecting to Solace message router using WebSocket transport url ws://' + host);
        sessionProperties.vpnName = vpn;
        consumer.log('Solace message router VPN name: ' + sessionProperties.vpnName);
        sessionProperties.userName = username;
        consumer.log('Client username: ' + sessionProperties.userName);
        sessionProperties.password = password;
        // create session
        try {
            consumer.session = solace.SolclientFactory.createSession(sessionProperties);
        } catch (error) {
            consumer.log(error.toString());
        }
        // define session event listeners
        consumer.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            consumer.log('=== Successfully connected and ready to start the message consumer. ===');
            consumer.startConsume();
        });
        consumer.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            consumer.log('Disconnected.');
            consumer.consuming = false;
            if (consumer.session !== null) {
                consumer.session.dispose();
                consumer.session = null;
            }
        });
        // connect the session
        try {
            consumer.session.connect();
        } catch (error) {
            consumer.log(error.toString());
        }
    };

    // Starts consuming from a Durable Topic Endpoint (DTE) on Solace message router
    consumer.startConsume = function () {
        if (consumer.session !== null) {
            if (consumer.consuming) {
                consumer.log('Already started consumer for DTE "' + consumer.topicEndpointName +
                    '" and ready to receive messages.');
            } else {
                consumer.log('Starting consumer for DTE: ' + consumer.topicEndpointName);
                try {
                    // Create a flow
                    consumer.flow = consumer.session.createSubscriberFlow(new solace.SubscriberFlowProperties({
                        endpoint: {
                            destination: consumer.topicDestination,
                            topicEndpointName: consumer.topicEndpointName,
                        },
                    }));
                    // Define flow event listeners
                    consumer.flow.on(solace.FlowEventName.UP, function () {
                        consumer.consuming = true;
                        consumer.log('=== Ready to receive messages. ===');
                    });
                    consumer.flow.on(solace.FlowEventName.BIND_FAILED_ERROR, function () {
                        consumer.consuming = false;
                        consumer.log('=== Error: the flow could not bind to DTE "' + consumer.topicEndpointName +
                            '" ===\n   Ensure the Durable Topic Endpoint exists on the message router vpn');
                    });
                    consumer.flow.on(solace.FlowEventName.DOWN, function () {
                        consumer.consuming = false;
                        consumer.log('=== An error happened, the flow is down ===');
                    });
                    // Define message event listener
                    consumer.flow.on(solace.FlowEventName.MESSAGE, function (message) {
                        consumer.log('Received message: "' + message.getBinaryAttachment() + '",' +
                            ' details:\n' + message.dump());
                    });
                    // Connect the flow
                    consumer.flow.connect();
                } catch (error) {
                    consumer.log(error.toString());
                }
            }
        } else {
            consumer.log('Cannot start the DTE consumer because not connected to Solace message router.');
        }
    };

    consumer.exit = function () {
        consumer.stopConsume();
        consumer.disconnect();
        setTimeout(function () {
            process.exit();
        }, 1000); // wait for 1 second to finish
    };

    // Disconnects the consumer from DTE on Solace message router
    consumer.stopConsume = function () {
        if (consumer.session !== null) {
            if (consumer.consuming) {
               consumer.consuming = false;
               consumer.log('Disconnecting consumption from DTE: ' + consumer.topicEndpointName);
                try {
                    consumer.flow.disconnect();
                    consumer.flow.dispose();
                } catch (error) {
                    consumer.log(error.toString());
                }
            } else {
                consumer.log('Cannot disconnect the consumer because it is not connected to DTE "' +
                    consumer.topicEndpointName + '"');
            }
        } else {
            consumer.log('Cannot disconnect the consumer because not connected to Solace message router.');
        }
    };

    // Gracefully disconnects from Solace message router
    consumer.disconnect = function () {
        consumer.log('Disconnecting from Solace message router...');
        if (consumer.session !== null) {
            try {
                consumer.session.disconnect();
            } catch (error) {
                consumer.log(error.toString());
            }
        } else {
            consumer.log('Not connected to Solace message router.');
        }
    };

    return consumer;
};

var solace = require('solclientjs').debug; // logging supported

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the consumer, specifying the name of the DTE and the topic
var consumer = new DTEConsumer(solace, 'tutorial/DTE', 'tutorial/topic');

// subscribe to messages on Solace message router
consumer.run(process.argv);

// wait to be told to exit
consumer.log("Press Ctrl-C to exit");
process.stdin.resume();

process.on('SIGINT', function () {
    'use strict';
    consumer.exit();
});
