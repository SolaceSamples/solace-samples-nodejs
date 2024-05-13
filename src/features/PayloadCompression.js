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
 *
 * Simple demonstration of the payload compression session property.
 * Creates a session with payload compression dialed to maximum,
 * subscribes to a topic,
 * sends a large but boring (compressible) message,
 * prints the number of bytes it took on the wire.
 *
 */

/*jslint es6 node:true devel:true*/

const solace = require('solclientjs').debug; // debug-level logging supported

solace.SolclientFactory.init();

solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
//solace.SolclientFactory.setLogLevel(solace.LogLevel.DEBUG);

const argv = process.argv;

// extract command line params
if (argv.length < (2 + 3)) { // expecting 3 real arguments
  console.log('Cannot connect: expecting all arguments' +
      ' <protocol://host[:port]> <client-username>@<message-vpn> <client-password>.\n' +
      'Available protocols are tcp:// and tcps://');
  process.exit();
}
const hosturl = argv.slice(2)[0];
console.log('Connecting to Solace PubSub+ Event Broker using url: ' + hosturl);
const usernamevpn = argv.slice(3)[0];
const username = usernamevpn.split('@')[0];
console.log('Client username: ' + username);
const vpn = usernamevpn.split('@')[1];
console.log('Solace PubSub+ Event Broker VPN name: ' + vpn);
const pass = argv.slice(4)[0];
// create session
const session = solace.SolclientFactory.createSession({
  // solace.SessionProperties
  url:      hosturl,
  vpnName:  vpn,
  userName: username,
  password: pass,
  sslValidateCertificate: false,
  // zlib compression level 1-9, or 0 for no compression.
  // 1: fastest compression
  // 9: most thorough compression
  // 0: No payload comppression on outgoing messages,
  //   but incoming payload-compressed messages are transparently decompred just the same.
  payloadCompressionLevel: 9,
});


session.on(solace.SessionEventCode.UP_NOTICE, ()=>{
  console.log("Session up, subscribing.");
  session.subscribe(solace.SolclientFactory.createTopicDestination("js/samples/payload_compression"), true);
});

session.on(solace.SessionEventCode.SUBSCRIPTION_OK, (e)=>{
  console.log("Session subscribed to topic, sending message with a thousand bytes, all the same");
  // Something large but compressible:
  var messageText = 'a'.repeat(1000);
  var message = solace.SolclientFactory.createMessage();
  message.setDestination(solace.SolclientFactory.createTopicDestination("js/samples/payload_compression"));
  message.setBinaryAttachment(messageText);
  message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
  session.send(message);
});

//Incoming messages with compressed payload are decompressed under the hood independently from the session property.
session.on(solace.SessionEventCode.MESSAGE, (msg)=>{
  console.log("Message received. Payload length:"+ msg.getBinaryAttachment().length);
  console.log("TX bytes:"+session.getStat(solace.StatType.TX_DIRECT_BYTES));
  console.log("RX bytes:"+session.getStat(solace.StatType.RX_DIRECT_BYTES));
});

session.connect();

