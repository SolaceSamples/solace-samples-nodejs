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
 * Active Flow Indication - Consumer
 * Demonstrates flow ACTIVE/INACTIVE notification to multiple message consumers bound to an exclusive queue
 */

/*jslint es6 node:true devel:true*/

var QueueConsumer = function (solaceModule, queueName) {
    'use strict';
    var solace = solaceModule;
    var consumer = {};
    consumer.session = null;
    consumer.msgConsumer1 = null;
    consumer.msgConsumer2 = null;
    consumer.queueName = queueName;
    consumer.consuming = false;
    consumer.numOfMessages = 10;
    consumer.receivedMessages = 0;

    // Logger
    consumer.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    consumer.log('\n*** Consumer to queue "' + consumer.queueName + '" is ready to connect ***');

    // main function
    consumer.run = function (argv) {
        consumer.connect(argv);
    };

    // Establishes connection to Solace message router
    consumer.connect = function (argv) {
        if (consumer.session !== null) {
            consumer.log('Already connected and ready to consume messages.');
            return;
        }
        // extract params
        if (argv.length < (2 + 3)) { // expecting 3 real arguments
            consumer.log('Cannot connect: expecting all arguments' +
                ' <protocol://host[:port]> <client-username>@<message-vpn> <client-password>.');
            return;
        }
        var hosturl = argv.slice(2)[0];
        consumer.log('Connecting to Solace message router using url: ' + hosturl);
        var usernamevpn = argv.slice(3)[0];
        var username = usernamevpn.split('@')[0];
        consumer.log('Client username: ' + username);
        var vpn = usernamevpn.split('@')[1];
        consumer.log('Solace message router VPN name: ' + vpn);
        var pass = argv.slice(4)[0];
        // create session
        try {
            consumer.session = solace.SolclientFactory.createSession({
                // solace.SessionProperties
                url:      hosturl,
                vpnName:  vpn,
                userName: username,
                password: pass,
            });
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

    // Starts consuming from a queue on Solace message router
    consumer.startConsume = function () {
        if (consumer.session !== null) {
            if (consumer.consuming) {
                consumer.log('Already started consumer for queue "' + consumer.queueName + '" and ready to receive messages.');
            } else {
                consumer.log('Starting consumer for exclusive queue: ' + consumer.queueName + ' on two flows.');
                try {
                    // Create the message consumers
                    consumer.msgConsumer1 = consumer.createActiveIndFlow(consumer.session, 'message consumer 1');
                    consumer.msgConsumer2 = consumer.createActiveIndFlow(consumer.session, 'message consumer 2');
                    // Connect the message consumer
                    consumer.msgConsumer1.connect();
                    consumer.msgConsumer2.connect();
                } catch (error) {
                    consumer.log("!!!" + error.toString());
                }
            }
        } else {
            consumer.log('Cannot start the queue consumer because not connected to Solace message router.');
        }
    };

    consumer.createActiveIndFlow = function (session, messageConsumerName) {
        // Create a message consumer
        const messageConsumer = consumer.session.createMessageConsumer({
            queueDescriptor: { name: consumer.queueName, type: solace.QueueType.QUEUE },
            acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
            activeIndicationEnabled: true,
        });
        // Define message consumer event listeners
        messageConsumer.on(solace.MessageConsumerEventName.UP, function () {
            consumer.consuming = true;
            consumer.log('=== ' + messageConsumerName + ': Ready to receive messages. ===');
        });
        messageConsumer.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR, function () {
            consumer.consuming = false;
            consumer.log('=== ' + messageConsumerName + ': Error: the message consumer could not bind to queue "' +
                consumer.queueName + '" ===\n   Ensure this queue exists on the message router vpn');
        });
        messageConsumer.on(solace.MessageConsumerEventName.DOWN, function () {
            consumer.consuming = false;
            consumer.log('=== ' + messageConsumerName + ': The message consumer is down ===');
        });
        messageConsumer.on(solace.MessageConsumerEventName.ACTIVE, function () {
            consumer.log('=== ' + messageConsumerName + ': received ACTIVE event');
        });
        messageConsumer.on(solace.MessageConsumerEventName.INACTIVE, function () {
            consumer.log('=== ' + messageConsumerName + ': received INACTIVE event');
        });
        // Define message event listener
        messageConsumer.on(solace.MessageConsumerEventName.MESSAGE, function (message) {
            consumer.receivedMessages += 1;
            consumer.log('Received message ' + consumer.receivedMessages + ' out of ' + consumer.numOfMessages +
                ' messages expected on ' + messageConsumerName);
            message.acknowledge();
            // Disconnect message consumer when target number of messages have been received
            if (consumer.receivedMessages === consumer.numOfMessages/2) {
                console.log('Disconnecting ' + messageConsumerName);
              messageConsumer.disconnect();
            }
            if (consumer.receivedMessages === consumer.numOfMessages) {
                console.log('Disconnecting ' + messageConsumerName);
                messageConsumer.disconnect();
                consumer.disconnect();
            }
        });
        return messageConsumer;
    }

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

// create the consumer, specifying the name of the queue
var consumer = new QueueConsumer(solace, 'tutorial/queue');

// subscribe to messages on Solace message router
consumer.run(process.argv);
