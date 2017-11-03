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
 * PublishSubscribe tutorial - Topic Publisher
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
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2), ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    publisher.log('\n*** Publisher to topic "' + publisher.topicName + '" is ready to connect ***');

    // main function
    publisher.run = function (hostname, vpnname, username, password) {
        publisher.connect(hostname, vpnname, username, password);
    };

    // Callback for message events
    publisher.messageEventCb = function (session, message) {
        publisher.log(message);
    };

    // Callback for session events
    publisher.sessionEventCb = function (session, event) {
        publisher.log(event.toString());
        if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
            publisher.log('=== Successfully connected and ready to publish messages. ===');
            publisher.publish();
            publisher.exit();
        } else if (event.sessionEventCode === solace.SessionEventCode.CONNECTING) {
            publisher.log('Connecting...');
        } else if (event.sessionEventCode === solace.SessionEventCode.DISCONNECTED) {
            publisher.log('Disconnected.');
            if (publisher.session !== null) {
                publisher.session.dispose();
                publisher.session = null;
            }
        }
    };

    // Establishes connection to Solace message router by its hostname
    publisher.connect = function (host, vpnname, username, password) {
        if (publisher.session !== null) {
            publisher.log('Already connected and ready to publish messages.');
        } else {
            if (host) {
                publisher.connectToSolace(host, vpnname, username, password);
            } else {
                publisher.log('Cannot connect: please specify the Solace message router web transport URL.');
            }
        }
    };

    publisher.connectToSolace = function (host, vpnname, username, password) {
        publisher.log('Connecting to Solace message router web transport URL ' + host + '.');
        var sessionProperties = new solace.SessionProperties();
        if (host.lastIndexOf('ws://', 0) === 0) { 
            sessionProperties.url = host;
        } else {
            sessionProperties.url = 'ws://' + host;
        }
        // NOTICE: the Solace router VPN name
        sessionProperties.vpnName = vpnname;
        publisher.log('Solace router VPN name: ' + sessionProperties.vpnName);
        // NOTICE: the client username
        sessionProperties.userName = username;
        publisher.log('Client username: ' + sessionProperties.userName);
        //NOTICE: the client password
        if (password) {
            sessionProperties.password = password;
        }
        publisher.session = solace.SolclientFactory.createSession(
            sessionProperties,
            new solace.MessageRxCBInfo(function (session, message) {
                // calling callback for message events
                publisher.messageEventCb(session, message);
            }, publisher),
            new solace.SessionEventCBInfo(function (session, event) {
                // calling callback for session events
                publisher.sessionEventCb(session, event);
            }, publisher)
        );
        try {
            publisher.session.connect();
        } catch (error) {
            publisher.log(error.toString());
        }
    };

    // Gracefully disconnects from Solace message router
    publisher.disconnect = function () {
        publisher.log('Disconnecting from Solace message router...');
        if (publisher.session !== null) {
            try {
                publisher.session.disconnect();
                publisher.session.dispose();
                publisher.session = null;
            } catch (error) {
                publisher.log(error.toString());
            }
        } else {
            publisher.log('Not connected to Solace message router.');
        }
    };

    // Publishes one message
    publisher.publish = function () {
        if (publisher.session !== null) {
            var messageText = 'Sample Message';
            var message = solace.SolclientFactory.createMessage();
            publisher.log('Publishing message "' + messageText + '" to topic "' + publisher.topicName + '"...');
            message.setDestination(solace.SolclientFactory.createTopic(publisher.topicName));
            // this is a text message
            message.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, messageText));
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
        setTimeout(function () {
            publisher.disconnect();
        }, 1000); // wait for 1 second to disconnect
        setTimeout(function () {
            process.exit();
        }, 2000); // wait for 2 seconds to exit
    };

    return publisher;
};

var solace = require('./lib/solclient-debug');

// enable logging to JavaScript console at WARN level
// NOTICE: works only with "lib/solclientjs-debug.js"
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.logLevel = solace.LogLevel.WARN;
solace.SolclientFactory.init(factoryProps);

// create the publisher, specifying the name of the subscription topic
var publisher = new TopicPublisher(solace, 'tutorial/topic');

var split = process.argv.slice(3)[0].split('@');

var host = process.argv.slice(2)[0];
var vpnname = split[1];
var username = split[0];
var password = process.argv.slice(4)[0];
// subscribe to messages on Solace message router
publisher.run(host, vpnname, username, password);
