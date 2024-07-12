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
 * Persistence with Queues tutorial - Queue browser
 * Demonstrates receiving persistent messages from a queue
 */

/*jslint es6 node:true devel:true*/

var QueueBrowser = function (solaceModule, queueName) {
    'use strict';
    var solace = solaceModule;
    var browser = {};
    browser.session = null;
    browser.queueName = queueName;
    browser.consuming = false;
    browser.messages = {};

    // Logger
    browser.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    browser.log('\n*** browser to queue "' + browser.queueName + '" is ready to connect ***');
  
    // main function
    browser.run = function (argv) {
        browser.connect(argv);
    };

    // Establishes connection to Solace PubSub+ Event Broker
    browser.connect = function (argv) {
        if (browser.session !== null) {
            browser.log('Already connected and ready to consume messages.');
            return;
        }
        // extract params
        if (argv.length < (2 + 3)) { // expecting 3 real arguments
            browser.log('Cannot connect: expecting all arguments' +
                ' <protocol://host[:port]> <client-username>@<message-vpn> <client-password>.\n' +
                'Available protocols are ws://, wss://, http://, https://, tcp://, tcps://');
            process.exit();
        }
        var hosturl = argv.slice(2)[0];
        browser.log('Connecting to Solace PubSub+ Event Broker using url: ' + hosturl);
        var usernamevpn = argv.slice(3)[0];
        var username = usernamevpn.split('@')[0];
        browser.log('Client username: ' + username);
        var vpn = usernamevpn.split('@')[1];
        browser.log('Solace PubSub+ Event Broker VPN name: ' + vpn);
        var pass = argv.slice(4)[0];
        // create session
        try {
            browser.session = solace.SolclientFactory.createSession({
                // solace.SessionProperties
                url:      hosturl,
                vpnName:  vpn,
                userName: username,
                password: pass,
            });
        } catch (error) {
            browser.log(error.toString());
        }
        // define session event listeners
        browser.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            browser.log('=== Successfully connected and ready to start the message browser. ===');
            browser.startBrowse();
        });
        browser.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
            browser.log('Connection failed to the message router: ' + sessionEvent.infoStr +
                ' - check correct parameter values and connectivity!');
        });
        browser.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            browser.log('Disconnected.');
            browser.consuming = false;
            if (browser.session !== null) {
                browser.session.dispose();
                browser.session = null;
            }
        });
        // connect the session
        try {
            browser.session.connect();
        } catch (error) {
            browser.log(error.toString());
        }
    };

    // Starts browsing from a queue on Solace PubSub+ Event Broker
    browser.startBrowse = function () {
        if (browser.session !== null) {
            if (browser.consuming) {
                browser.log('Already started browser for queue "' + browser.queueName +
                    '" and ready to receive messages.');
            } else {
                browser.log('Starting browser for queue: ' + browser.queueName);
                try {
                    // Create a message browser
                    browser.messageBrowser = browser.session.createQueueBrowser({
                        queueDescriptor: { name: browser.queueName, type: solace.QueueType.QUEUE }
                    });
                    // Define message browser event listeners
                    browser.messageBrowser.on(solace.QueueBrowserEventName.UP, function () {
                        browser.consuming = true;
                        browser.log('=== Ready to receive messages. ===');
                    });
                    browser.messageBrowser.on(solace.QueueBrowserEventName.CONNECT_FAILED_ERROR, function () {
                        browser.consuming = false;
                        browser.log('=== Error: the message browser could not bind to queue "' + browser.queueName +
                            '" ===\n   Ensure this queue exists on the message router vpn');
                        browser.exit();
                    });
                    browser.messageBrowser.on(solace.QueueBrowserEventName.DOWN, function () {
                        browser.consuming = false;
                        browser.log('=== The message browser is now down ===');
                    });
                    browser.messageBrowser.on(solace.QueueBrowserEventName.DOWN_ERROR, function () {
                        browser.consuming = false;
                        browser.log('=== An error happened, the message browser is down ===');
                    });
                    // Define message received event listener
                    browser.messageBrowser.on(solace.QueueBrowserEventName.MESSAGE, function (message) {
                        browser.log('Received message: ' + message.getGuaranteedMessageId());
                        browser.messages[message.getGuaranteedMessageId()] = message;
                        // Need to explicitly ack otherwise it will not be deleted from the message router
                        // message.acknowledge();
                    });
                    // Connect the message browser
                    browser.messageBrowser.connect();
                } catch (error) {
                    browser.log(error.toString());
                }
            }
        } else {
            browser.log('Cannot start the queue browser because not connected to Solace PubSub+ Event Broker.');
        }
    };

    browser.exit = function () {
        browser.stopConsume();
        browser.disconnect();
        setTimeout(function () {
            process.exit();
        }, 1000); // wait for 1 second to finish
    };

    // Disconnects the browser from queue on Solace PubSub+ Event Broker
    browser.stopConsume = function () {
        if (browser.session !== null) {
            if (browser.consuming) {
                browser.consuming = false;
                browser.log('Disconnecting consumption from queue: ' + browser.queueName);
                try {
                    browser.messageBrowser.disconnect();
                    browser.messageBrowser.dispose();
                } catch (error) {
                    browser.log(error.toString());
                }
            } else {
                browser.log('Cannot disconnect the browser because it is not connected to queue "' +
                    browser.queueName + '"');
            }
        } else {
            browser.log('Cannot disconnect the browser because not connected to Solace PubSub+ Event Broker.');
        }
    };

    // Gracefully disconnects from Solace PubSub+ Event Broker
    browser.disconnect = function () {
        browser.log('Disconnecting from Solace PubSub+ Event Broker...');
        if (browser.session !== null) {
            try {
                browser.session.disconnect();
            } catch (error) {
                browser.log(error.toString());
            }
        } else {
            browser.log('Not connected to Solace PubSub+ Event Broker.');
        }
    };

    browser.removeMessage = function (messageId) {
        browser.log("Removing message from queue: " + messageId);
        const messageToRemove = browser.messages[messageId];
        if(messageToRemove !== null ) {
            browser.log("Found message to remove: " + messageToRemove.dump());
            browser.messageBrowser.removeMessageFromQueue(messageToRemove);
        } else {
            browser.log("Message not found for messageId: " + messageId);
        }
    }

    return browser;
};

var solace = require('solclientjs').debug; // logging supported
const readline = require('readline');

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the browser, specifying the name of the queue
var browser = new QueueBrowser(solace, 'tutorial/queue');

// subscribe to messages on Solace PubSub+ Event Broker
browser.run(process.argv);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', function (messageId) {
    browser.log(`Received messageid: ${messageId}`);
    browser.removeMessage(messageId);
});


// wait to be told to exit
browser.log("Press Ctrl-C to exit");
process.stdin.resume();

process.on('SIGINT', function () {
    'use strict';
    browser.exit();
});
