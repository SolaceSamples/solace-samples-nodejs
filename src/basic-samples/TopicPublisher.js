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
 * Publish/Subscribe tutorial - Topic Publisher
 * Demonstrates publishing direct messages to a topic
 */

/*jslint es6 node:true devel:true*/

var TopicPublisher = function (solaceModule, topicName) {
    'use strict';
    var solace = solaceModule;
    var publisher = {};
    publisher.session = null;
    publisher.topicName = topicName;

    // Logger
    publisher.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    publisher.log('\n*** Publisher to topic "' + publisher.topicName + '" is ready to connect ***');

    // main function
    publisher.run = function (argv) {
        if (argv.length >= (2 + 4)) { // expecting 4 real arguments
            publisher.connect(argv.slice(2)[0], argv.slice(3)[0], argv.slice(4)[0], argv.slice(5)[0]);
        } else {
            publisher.log('Cannot connect: expecting all arguments' +
                ' <host:port> <client-username> <client-password> <message-vpn>.');
        }
    };

    // Establishes connection to Solace message router by its hostname
    publisher.connect = function (host, username, password, vpn) {
        if (publisher.session !== null) {
            publisher.log('Already connected and ready to publish.');
        } else {
            publisher.connectToSolace(host, username, password, vpn);
        }
    };

    publisher.connectToSolace = function (host, username, password, vpn) {
        const sessionProperties = new solace.SessionProperties();
        sessionProperties.url = 'ws://' + host;
        publisher.log('Connecting to Solace message router using WebSocket transport url ws://' + host);
        sessionProperties.vpnName = vpn;
        publisher.log('Solace message router VPN name: ' + sessionProperties.vpnName);
        sessionProperties.userName = username;
        publisher.log('Client username: ' + sessionProperties.userName);
        sessionProperties.password = password;
        // create session
        publisher.session = solace.SolclientFactory.createSession(sessionProperties);
        // define session event listeners
        publisher.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            publisher.log('=== Successfully connected and ready to publish messages. ===');
            publisher.publish();
            publisher.exit();
        });
        publisher.session.on(solace.SessionEventCode.CONNECTING, (sessionEvent) => {
            publisher.log('Connecting...');
        });
        publisher.session.on(solace.SessionEventCode.DISCONNECTED, (sessionEvent) => {
            publisher.log('Disconnected.');
            if (publisher.session !== null) {
                publisher.session.dispose();
                publisher.session = null;
            }
        });
        // connect the session
        try {
            publisher.session.connect();
        } catch (error) {
            publisher.log(error.toString());
        }
    };

    // Publishes one message
    publisher.publish = function () {
        if (publisher.session !== null) {
            var messageText = 'Sample Message';
            var message = solace.SolclientFactory.createMessage();
            publisher.log('Publishing message "' + messageText + '" to topic "' + publisher.topicName + '"...');
            message.setDestination(solace.SolclientFactory.createTopic(publisher.topicName));
            message.setBinaryAttachment(messageText);
            message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
            try {
                publisher.session.send(message);
                publisher.log('Message published.');
            } catch (error) {
                publisher.log(error.toString());
            }
        } else {
            publisher.log('Cannot publish because not connected to Solace message router.');
        }
    };

    publisher.exit = function () {
        publisher.disconnect();
        setTimeout(function () {
            process.exit();
        }, 1000); // wait for 1 second to finish
    };

    // Gracefully disconnects from Solace message router
    publisher.disconnect = function () {
        publisher.log('Disconnecting from Solace message router...');
        if (publisher.session !== null) {
            try {
                publisher.session.disconnect();
            } catch (error) {
                publisher.log(error.toString());
            }
        } else {
            publisher.log('Not connected to Solace message router.');
        }
    };

    return publisher;
};

var solace = require('solclientjs').debug; // logging supported

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the publisher, specifying the name of the subscription topic
var publisher = new TopicPublisher(solace, 'tutorial/topic');

// publish message to Solace message router
publisher.run(process.argv);
