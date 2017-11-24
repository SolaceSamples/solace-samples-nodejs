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
 * Confirmed Delivery tutorial
 * Demonstrates handling persistent message acknowledgements on message send
 */

/*jslint es6 node:true devel:true*/

var QueueProducer = function (solaceModule, queueName) {
    'use strict';
    var solace = solaceModule;
    var producer = {};
    producer.session = null;
    producer.queueName = queueName;
    producer.numOfMessages = 10;
    producer.messageAckRecvd = 0;

    // Logger
    producer.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    producer.log('\n*** Producer to queue "' + producer.queueName + '" is ready to connect ***');

    // main function
    producer.run = function (argv) {
        producer.connect(argv);
    };

    // Establishes connection to Solace message router
    producer.connect = function (argv) {
        if (producer.session !== null) {
            producer.log('Already connected and ready to publish.');
            return;
        }
        // extract params
        if (argv.length < (2 + 3)) { // expecting 3 real arguments
            producer.log('Cannot connect: expecting all arguments' +
                ' <protocol://host[:port]> <client-username>@<message-vpn> <client-password>.\n' +
                'Available protocols are ws://, wss://, http://, https://');
            return;
        }
        var hosturl = argv.slice(2)[0];
        producer.log('Connecting to Solace message router using url: ' + hosturl);
        var usernamevpn = argv.slice(3)[0];
        var username = usernamevpn.split('@')[0];
        producer.log('Client username: ' + username);
        var vpn = usernamevpn.split('@')[1];
        producer.log('Solace message router VPN name: ' + vpn);
        var pass = argv.slice(4)[0];
        // create session
        try {
            producer.session = solace.SolclientFactory.createSession({
                // solace.SessionProperties
                url:      hosturl,
                vpnName:  vpn,
                userName: username,
                password: pass,
                publisherProperties: {
                    acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE,
                },
            });
        } catch (error) {
            producer.log(error.toString());
        }
        // define session event listeners
        producer.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            producer.log('=== Successfully connected and ready to send messages. ===');
            producer.sendMessages();
        });
        producer.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
            producer.log('Connection failed to the message router: ' + sessionEvent.infoStr +
                ' - check correct parameter values and connectivity!');
        });
        producer.session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, function (sessionEvent) {
            producer.log('Delivery of message with correlation key = ' +
                JSON.stringify(sessionEvent.correlationKey) + ' confirmed.');
            producer.messageAckRecvd++;
            if (producer.messageAckRecvd === producer.numOfMessages) {
                producer.exit();
            }
        });
        producer.session.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, function (sessionEvent) {
            producer.log('Delivery of message with correlation key = ' +
                JSON.stringify(sessionEvent.correlationKey) + ' rejected, info: ' + sessionEvent.infoStr);
            producer.messageAckRecvd++;
            if (producer.messageAckRecvd === producer.numOfMessages) {
                producer.exit();
            }
        });
        producer.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            producer.log('Disconnected.');
            if (producer.session !== null) {
                producer.session.dispose();
                producer.session = null;
            }
        });
        // connect the session
        try {
            producer.session.connect();
        } catch (error) {
            producer.log(error.toString());
        }
    };

    producer.sendMessages = function () {
        if (producer.session !== null) {
            for (var i = 1; i <= producer.numOfMessages; i++) {
                producer.sendMessage(i);
            }
        } else {
            producer.log('Cannot send messages because not connected to Solace message router.');
        }
    }

    // Sends one message
    producer.sendMessage = function (sequenceNr) {
        var messageText = 'Sample Message';
        var message = solace.SolclientFactory.createMessage();
        message.setDestination(solace.SolclientFactory.createDurableQueueDestination(producer.queueName));
        message.setBinaryAttachment(messageText);
        message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
        // Define a correlation key object
        const correlationKey = {
            name: "MESSAGE_CORRELATIONKEY",
            id: sequenceNr,
        };
        message.setCorrelationKey(correlationKey);
        try {
            producer.session.send(message);
            producer.log('Message #' + sequenceNr + ' sent to queue "' + producer.queueName + '", correlation key = ' + JSON.stringify(correlationKey));
        } catch (error) {
            producer.log(error.toString());
        }
    };

    producer.exit = function () {
        producer.disconnect();
        setTimeout(function () {
            process.exit();
        }, 1000); // wait for 1 second to finish
    };

    // Gracefully disconnects from Solace message router
    producer.disconnect = function () {
        producer.log('Disconnecting from Solace message router...');
        if (producer.session !== null) {
            try {
                producer.session.disconnect();
            } catch (error) {
                producer.log(error.toString());
            }
        } else {
            producer.log('Not connected to Solace message router.');
        }
    };

    return producer;
};

var solace = require('solclientjs').debug; // logging supported

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the producer, specifying the name of the destination queue
var producer = new QueueProducer(solace, 'tutorial/queue');

// send message to Solace message router
producer.run(process.argv);
