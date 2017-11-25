---
layout: tutorials
title: Persistence with Queues
summary: Learn how to set up persistence for guaranteed delivery.
icon: I_dev_Persistent.svg
links:
    - label: QueueProducer.js
      link: /blob/master/src/basic-samples/QueueProducer.js
    - label: QueueConsumer.js
      link: /blob/master/src/basic-samples/QueueConsumer.js
---

This tutorial builds on the basic concepts introduced in the [publish/subscribe tutorial]({{ site.baseurl }}/publish-subscribe), and will show you how to send and receive Persistent (Guaranteed) Messages from a Solace message router queue in a point to point fashion.

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.
*   You have access to a running Solace message router with the following configuration:
    *   Enabled message VPN
    *   Enabled client username

One simple way to get access to a Solace message router is to start a Solace VMR load [as outlined here]({{ site.docs-vmr-setup }}){:target="_top"}. By default the Solace VMR will run with the “default” message VPN configured and ready for messaging. Going forward, this tutorial assumes that you are using the Solace VMR. If you are using a different Solace message router configuration, adapt the instructions to match your configuration.

## Goals

The goal of this tutorial is to understand the following:

1.  How to send a guaranteed message to a Solace queue
2.  How to bind to this queue and receive a guaranteed message

## Solace message router properties

In order to send or receive messages to a Solace message router, you need to know a few details of how to connect to the Solace message router. Specifically you need to know the following:

<table>
<tbody>
<tr>
<td>Resource</td>
<td>Value</td>
<td>Description</td>
</tr>
<tr>
<td>Host url</td>
<td>String of the form <code>protocol://DNS name:Port</code> or <code>protocol://IP:Port</code></td>
<td>This is the address clients use when connecting to the Solace message router to send and receive messages. If Port is not provided the default port for the protocol will be used. For a Solace VMR there is only a single interface so the IP is the same as the management IP address.
For Solace message router appliances this is the host address of the message-backbone.
Available protocols are <code>ws://</code>, <code>wss://</code>, <code>http://</code> and <code>https://</code>
</td>
</tr>
<tr>
<td>Message VPN</td>
<td>String</td>
<td>The Solace message router Message VPN that this client should connect to. For the Solace VMR the simplest option is to use the “default” message-vpn which is fully enabled for message traffic.</td>
</tr>
<tr>
<td>Client Username</td>
<td>String</td>
<td>The client username. For the Solace VMR default message VPN, authentication is disabled by default, so this can be any value.</td>
</tr>
<tr>
<td>Client Password</td>
<td>String</td>
<td>The client password. For the Solace VMR default message VPN, authentication is disabled by default, so this can be any value.</td>
</tr>
</tbody>
</table>

This information will be passed as arguments to the sample scripts as described in the "Running the Samples" section below.

## Obtaining the Solace API

This tutorial depends on you having the Solace Node.js API version 10 or later downloaded and available. Here are a few easy ways to get the Node.js API. The instructions in the Building section assume you're pulling the packages from the `npmjs` public repository. If your environment differs then adjust the build instructions appropriately.

The API Reference is available online at the [Node.js API documentation]({{ site.docs-api-reference }}){:target="_top"}.

### Get the API: Using the npmjs repository

This will locate and download the packages from the `npmjs` public repository.

```
npm install solclientjs@">=10.0.0"
```

### Get the API: Using the Solace Developer Portal

The Solace Node.js API distribution package can be [downloaded here]({{ site.links-downloads }}){:target="_top"}. Install the included tar.gz tarball package named `node-solclientjs-<version>.tar.gz`:
	
```
npm install <path_to_tarball_directory>/node-solclientjs-<version>.tar.gz 
```

## Trying it yourself

This tutorial is available in [GitHub]({{ site.repository }}){:target="_blank"} along with the other [Solace Developer Getting Started Examples]({{ site.links-get-started }}){:target="_top"}.

At the end, this tutorial walks through downloading and running the sample from source.

## Prerequisite: Creating a Durable Queue on the Solace message router

A difference with the publish/subscribe tutorial is that for guaranteed messaging a physical endpoint resource – a durable queue, associated with the queue destination – needs to be created on the Solace message router, which will persist the messages until consumed.

You can use SolAdmin or SEMP to create a durable queue. This tutorial assumes that the queue named `tutorial/queue` has been created.  Ensure the queue is enabled for both Incoming and Outgoing messages and set the Permission to at least 'Consume'.

## Loading and Initializing the Solace Node.js API

To load the Solace Node.js API into your Node.js application simply include the `solclientjs` module.

```javascript
var solace = require('solclientjs');
```

Use the debug version of the API of the `solclientjs` module instead, if you’re planning to see console log messages and/or debug it.

```javascript
var solace = require('solclientjs').debug; // logging is supported here
```

Then initialize the `SolclientFactory`, which is the first entry point to the API. Add the following to initialize with the latest `version10` behavior profile to run with the default property values that Solace recommends at the time of the version 10 release.

```javascript
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);
```

If the debug version of the API has been loaded the required level of logging can be set like so:

```javascript
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
```

## Implementing Guaranteed Messaging

For guaranteed messaging, we will use a "producer" to send messages to and a "consumer" to receive messages from a durable queue configured on the Solace message router. The producer will use a `MessagePublisher` embedded into the `Session` object to send, and the consumer will bind to a queue destination and use a `MessageConsumer` object to receive guaranteed messages.

### Connecting to the Solace message router

Similar to the publish/subscribe tutorial, an application must connect a Solace session. The Solace session is the basis for all client communication with the Solace message router.

The `solace.SolclientFactory` is used to create a Solace `Session` from `SessionProperties`.

The following is an example of a session creating and connecting to the Solace message router for the producer.

Compared to the publish/subscribe tutorial, here it is not required to specify a message event listener for the `Session` object. Guaranteed messages are delivered to event listeners defined for the `MessageConsumer` object instead.

```javascript
// create session
producer.session = solace.SolclientFactory.createSession({
    // solace.SessionProperties
    url:      hosturl,
    vpnName:  vpn,
    userName: username,
    password: pass,
});
// define session event listeners
    /*...see section Session Events...*/
// connect the session
try {
    producer.session.connect();
} catch (error) {
    producer.log(error.toString());
}
```

At this point your Node.js application is connected as a client to the Solace message router. You can use SolAdmin to view this client connection and related details.

#### Session Events

The Solace Node.js API communicates changes in status and results of connect calls through emitting session events with certain event names.

It is necessary to wire your application logic to session events through listeners to take appropriate action. The most important session events are:

*   `SessionEventCode.UP_NOTICE`: session has been successfully connected to the Solace message router
*   `SessionEventCode.CONNECT_FAILED_ERROR`: unable to connect to the Solace message router
*   `SessionEventCode.DISCONNECTED`: session has been disconnected from the Solace message router

This is how event listeners can be defined in the sample producer, and the sample consumer is very similar:

```javascript
// define session event listeners
producer.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
    producer.log('=== Successfully connected and ready to send messages. ===');
    producer.sendMessage();
    producer.exit();
});
producer.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
    producer.log('Connection failed to the message router: ' + sessionEvent.infoStr +
        ' - check correct parameter values and connectivity!');
});
producer.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
    producer.log('Disconnected.');
    if (producer.session !== null) {
                                
     
        producer.session.dispose();
        producer.session = null;
    }
});
```
Note that the application logic can be triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event.


### Sending a message to a queue

Now it is time to send a message to the queue. Remember that the queue must be pre-configured on the message router as described in the "Creating a Durable Queue" section.

![sending-message-to-queue]({{ site.baseurl }}/images/sending-message-to-queue-300x160.png)

The actual method calls to create and send guaranteed messages to a queue are similar to those used for direct messages in the publish/subscribe tutorial. The differences are:
* a durable queue type destination is created and used; and
* the delivery mode is set to PERSISTENT.

```javascript
var messageText = 'Sample Message';
var message = solace.SolclientFactory.createMessage();
producer.log('Sending message "' + messageText + '" to queue "' + producer.queueName + '"...');
message.setDestination(solace.SolclientFactory.createDurableQueueDestination(producer.queueName));
message.setBinaryAttachment(messageText);
message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
try {
    producer.session.send(message);
    producer.log('Message sent.');
} catch (error) {
    producer.log(error.toString());
}
```

At this point the producer has sent a message to the Solace message router and it will be waiting for your consumer on the queue.

### Receiving a message from a queue

Now it is time to receive the messages sent to your queue.

![]({{ site.baseurl }}/images/receiving-message-from-queue-300x160.png)

Receiving guaranteed messages is different from the direct messaging case described in the the publish/subscribe tutorial.

To receive guaranteed messages, a connected `Session` is used to create a Solace `MessageConsumer` object from `MessageConsumerProperties` and then connected, meaning that it will bind to the queue on the message router and can start receiving messages.

```javascript
// Create message consumer
consumer.messageConsumer = consumer.session.createMessageConsumer({
    // solace.MessageConsumerProperties
    queueDescriptor: { name: consumer.queueName, type: solace.QueueType.QUEUE },
    acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT, // Enabling Client ack
});
// define message consumer event listeners
    /*...see section Message Consumer Events...*/
// define message received event listener
    /*...see section Message Consumer Message Received Event...*/
// connect the message consumer
try {
    consumer.messageConsumer.connect();
} catch (error) {
    consumer.log(error.toString());
}
```

Notice that here we use the Solace "client acknowledgement mode", which allows the consumers to acknowledge each message individually. You can learn more about acknowledgement modes in the [Solace Documentation – Acknowledging Messages Received by Clients]({{ site.docs-msg-consumer-ack-modes }}){:target="_top"}.

```javascript
    acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT, // Enabling Client ack
```

#### Message Consumer Events

Message consumer related events will be sent to the event listeners defined for the `MessageConsumer`. The most important events are:

*   `MessageConsumerEventName.UP`: the message consumer has successfully bound to the destination and ready to receive messages
*   `MessageConsumerEventName.CONNECT_FAILED_ERROR`: the message consumer has not been able to bind to the destination
*   `MessageConsumerEventName.DOWN`: the message consumer has been disconnected.

```javascript
// Define message consumer event listeners
consumer.messageConsumer.on(solace.MessageConsumerEventName.UP, function () {
    consumer.consuming = true;
    consumer.log('=== Ready to receive messages. ===');
});
consumer.messageConsumer.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR, function () {
    consumer.consuming = false;
    consumer.log('=== Error: the message consumer could not bind to queue "' + consumer.queueName +
        '" ===\n   Ensure this queue exists on the message router vpn');
});
consumer.messageConsumer.on(solace.MessageConsumerEventName.DOWN, function () {
    consumer.consuming = false;
    consumer.log('=== An error happened, the message consumer is down ===');
});
```

#### Message Consumer Message Received Event

Message received events will be sent to the message received event listener defined for the message consumer. Successful processing of a message must be explicitly acknowledged because "client acknowledgement mode" is used:

```javascript
// Define message received event listener
consumer.messageConsumer.on(solace.MessageConsumerEventName.MESSAGE, function (message) {
    consumer.log('Received message: "' + message.getBinaryAttachment() + '",' +
        ' details:\n' + message.dump());
    // Need to explicitly ack otherwise it will not be deleted from the message router
    message.acknowledge();
});
```

## Summarizing

The full source code for this example is available in [GitHub]({{ site.repository }}){:target="_blank"}. If you combine the example source code shown above results in the following source:

*   [QueueProducer.js]({{ site.repository }}/blob/master/src/basic-samples/QueueProducer.js)
*   [QueueConsumer.js]({{ site.repository }}/blob/master/src/basic-samples/QueueConsumer.js)


### Getting the Source

Clone the GitHub repository containing the Solace samples.

```
git clone {{ site.repository }}
cd {{ site.baseurl | remove: '/'}}
```

### Installing the Node.js API

For a local installation of the API package, run from the current `{{ site.baseurl | remove: '/'}}` directory:

```
npm install solclientjs
```

### Running the Samples

The samples consist of two separate producer and consumer Node.js applications in the `/src/basic-samples` directory: `QueueProducer.js` and `QueueConsumer.js`.

The producer application sends one message and exits, the consumer application is running until Ctrl-C is pressed on the console.

**Sample Output**

First run `QueueConsumer.js` in Node.js, giving it following arguments:

```
node QueueConsumer.js <protocol://host:port> <client-username>@<message-vpn> <client-password>
```

The following is the output of the tutorial’s `QueueConsumer.js` application after it successfully connected to the Solace message router and bound to the queue.  

```bash
$ node QueueConsumer.js ws://192.168.133.64 testuser@default passw
[11:35:05]
*** Consumer to queue "tutorial/queue" is ready to connect ***
[11:35:05] Connecting to Solace message router using url: ws://192.168.133.64
[11:35:05] Client username: testuser
[11:35:05] Solace message router VPN name: default
[11:35:05] Press Ctrl-C to exit
[11:35:05] === Successfully connected and ready to start the message consumer. ===
[11:35:05] Starting consumer for queue: tutorial/queue
[11:35:05] === Ready to receive messages. ===
```

Now, run `QueueProducer.js` in Node.js, also specifying the same arguments.

```
node QueueProducer.js <protocol://host:port> <client-username>@<message-vpn> <client-password>
```

It will connect to the router, send a message and exit.

The following is the output of the tutorial’s `QueueProducer.js` application after it successfully connected to the Solace message router, published a message and exited.  

```bash
$ node QueueProducer.js ws://192.168.133.64 testuser@default passw
[11:35:37]
*** Producer to queue "tutorial/queue" is ready to connect ***
[11:35:37] Connecting to Solace message router using url: ws://192.168.133.64
[11:35:37] Client username: testuser
[11:35:37] Solace message router VPN name: default
[11:35:37] === Successfully connected and ready to send messages. ===
[11:35:37] Sending message "Sample Message" to queue "tutorial/queue"...
[11:35:37] Message sent.
[11:35:37] Disconnecting from Solace message router...
[11:35:37] Disconnected.
```

This is the subscriber receiving a message (`QueueConsumer.js`):  

```bash
[11:35:37] Received message: "Sample Message", details:
Destination:                            [Queue tutorial/queue]
Class Of Service:                       COS1
DeliveryMode:                           PERSISTENT
Message Id:                             8106
Expiration:                             0 (Wed Dec 31 1969 19:00:00 GMT-0500 (Eastern Standard Time))
Binary Attachment:                      len=14
  53 61 6d 70 6c 65 20 4d    65 73 73 61 67 65          Sample.Message
```

You have now successfully connected a client, sent guaranteed messages to a queue and received them from a consumer flow.

If you have any issues sending and receiving a message, check the [Solace community]({{ site.links-community }}){:target="_top"} for answers to common issues.
