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
 * Simple demonstration of the endpoint provision and deprovision functions.
 * Creates and connects a session, attempts a few operations, prints the outcome.
 *
 */

/*jslint es6 node:true devel:true*/

const solace = require('solclientjs').debug; // debug-level logging supported

solace.SolclientFactory.init();

solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

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
});

// The event is printed to demonstrate how it contains the properties of the queue even if left for the broker defaults.
session.on(solace.SessionEventCode.PROVISION_OK, event => console.log(event.correlationKey + "successful!\n"+ event ));

session.on(solace.SessionEventCode.PROVISION_ERROR,event => console.log(event.correlationKey + "failed!\n"+ event ));

// Provision/deprovison operations fail when the session is not connected.
session.on(solace.SessionEventCode.UP_NOTICE, ()=>{
  session.provisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, {quotaMB:1}, true, "Create new queue");
  session.provisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, {quotaMB:1}, false, "Recreate the queue, should fail");
  session.provisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, {quotaMB:1}, true, "Recreate the queue, or do nothing if exists");
  session.provisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, {quotaMB:2}, true, "Recreate queue with differet params: should fail.");
  session.deprovisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, false, "Delete queue");
  session.provisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, {quotaMB:2}, true, "Recreate queue with differet params again");
  session.deprovisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, false, "Delete queue after recreating.");
  session.deprovisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, false, "Delete queue when already deleted: should fail");
  session.deprovisionEndpoint({name:"newQueue", type:solace.QueueType.QUEUE}, true, "Delete queue yet again, or do nothing if doesn't exist.");
});

session.connect();

