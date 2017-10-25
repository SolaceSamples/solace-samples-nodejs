---
layout: tutorials
title: Persistence with Queues
summary: Learn how to set up persistence for guaranteed delivery.
icon: I_dev_Persistent.svg
---

This tutorial builds on the basic concepts introduced in the [publish/subscribe tutorial]({{ site.baseurl }}/publish-subscribe), and will show you how to send and receive persistent messages from a Solace message router queue in a point to point fashion.

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.

```************** Note: expand with DataGo options **************```

*   You have access to a running Solace message router with the following configuration:
    *   Enabled message VPN
    *   Enabled client username

One simple way to get access to a Solace message router is to start a Solace VMR load [as outlined here]({{ site.docs-vmr-setup }}){:target="_top"}. By default the Solace VMR will run with the “default” message VPN configured and ready for messaging. Going forward, this tutorial assumes that you are using the Solace VMR. If you are using a different Solace message router configuration, adapt the instructions to match your configuration.

The build instructions in this tutorial assume you are using a Linux shell. If your environment differs, adapt the instructions.

## Goals

The goal of this tutorial is to understand the following:

1.  How to send a persistent message to a Solace queue
2.  How to bind to this queue and receive a persistent message

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
<td>Host</td>
<td>String of the form <code>DNS name</code> or <code>IP:Port</code></td>
<td>This is the address clients use when connecting to the Solace message router to send and receive messages. For a Solace VMR this there is only a single interface so the IP is the same as the management IP address.
For Solace message router appliances this is the host address of the message-backbone.
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

This information will be need to be passed as arguments to the sample scripts as described in the "Running the Samples" section below.

## Obtaining the Solace API

This tutorial depends on you having the Solace Node.js API downloaded and available. Here are a few easy ways to get the Node.js API. The instructions in the Building section assume you're pulling the packages from the `npmjs` public repository. If your environment differs then adjust the build instructions appropriately.

The API Reference is available online at the [Node.js API documentation]({{ site.docs-api-reference }}){:target="_top"}.

### Get the API: Using the npmjs repository

This will locate and download the packages from the `npmjs` public repository.

```
npm install solclientjs
```

### Get the API: Using the Solace Developer Portal

The Solace Node.js API distribution package can be [downloaded here]({{ site.links-downloads }}){:target="_top"}. Install the included tar.gz tarball package named `node-solclientjs-<version>.tar.gz`:
	
```
npm install <path_to_tarball_directory>/node-solclientjs-<version>.tar.gz 
```

## Trying it yourself

This tutorial is available in [GitHub]({{ site.repository }}){:target="_blank"} along with the other [Solace Developer Getting Started Examples]({{ site.links-get-started }}){:target="_top"}.

At the end, this tutorial walks through downloading and running the sample from source.

## Creating a durable queue on the Solace message router

A difference to the publish/subscribe tutorial is that here a physical endpoint resource – a durable queue, associated with the Queue Destination – needs to be created on the Solace message router, which will persist the messages until consumed.

You can use SolAdmin to create a durable queue. This tutorial assumes that the queue named `tutorial/queue` has been created.

```************** Note: expand on other options how to create a queue: SEMP, web mgmt **************```

## Loading and Initializing the Solace Node.js API

To load the Solace Node.js API into your Node.js application simply include the `solclientjs` module.

```javascript
var solace = require('solclientjs');
```

Use the debug version of the API of the `solclientjs` module instead, if you’re planning to see console log messages and/or debug it.

```javascript
var solace = require('solclientjs').debug; // logging is supported here
```

Then initialize the `SolclientFactory`, which is the first entry point to the API. Use the latest `version10` default settings profile to unlock all Solace Node.js API features.

```javascript
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);
```

If the debug version of the API has been loaded the required level of logging can be set like so:

```javascript
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
```

## Implementing Persistent Messaging

For persistent messaging, we will use a "producer" to send messages to and a "consumer" to receive messages from a durable queue configured on the Solace message router. The producer will use a `PublisherFlow` object to send, and the consumer will bind to a queue destination and use a `SubscriberFlow` object to receive guaranteed messages.

### Connecting to the Solace message router

Similarly to the publish/subscribe tutorial, an application must connect a Solace session. The Solace session is the basis for all client communication with the Solace message router.

The `solace.SolclientFactory` is used to create Solace session from a set of `SessionProperties`.

The following is an example of session creating and connecting to the Solace message router for the producer. Notice that additionally to the `sessionProperties` fields defining Solace message router properties, the `publisherProperties` field must be set to enabled to __send__ durable messages.  This is not required for the consumer's code.

Compared to the publish/subscribe tutorial, it is also not required to specify a message event listener for the `Session` object. Guaranteed messages are delivered to event listeners defined for the `SubscriberFlow` object instead.

```javascript
var sessionProperties = new solace.SessionProperties();
sessionProperties.url = 'ws://' + host;
sessionProperties.vpnName = vpn;
sessionProperties.userName = username;
sessionProperties.password = password;
sessionProperties.publisherProperties = new solace.PublisherFlowProperties({enabled: true});
// create session
producer.session = solace.SolclientFactory.createSession(sessionProperties);
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

### Session Events

The Solace Node.js API communicates changes in status and results of connect calls through emitting session events with certain event names.

It is necessary to wire your application logic to session events through listeners to take appropriate action. The most important session events are:

*   `SessionEventCode.UP_NOTICE`: success connecting session to the Solace message router
*   `SessionEventCode.DISCONNECTED`: session was disconnected from the Solace message router

This is how event listeners can be defined in the sample producer and the sample consumer is very similar:

```JavaScript
// define session event listeners
producer.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
    producer.log('=== Successfully connected and ready to send messages. ===');
    producer.sendMessage();
    producer.exit();
});
producer.session.on(solace.SessionEventCode.CONNECTING, (sessionEvent) => {
    producer.log('Connecting...');
});
producer.session.on(solace.SessionEventCode.DISCONNECTED, (sessionEvent) => {
    producer.log('Disconnected.');
    if (producer.session !== null) {
        producer.session.dispose();
        producer.session = null;
    }
});
```
Note that the application logic can be triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event.


### Sending a message to a queue

Now it is time to send a message to the queue. 

![sending-message-to-queue]({{ site.baseurl }}/images/sending-message-to-queue-300x160.png)

Remember to enable `publisherProperties` for `sessionProperties` as discussed above:

```
sessionProperties.publisherProperties = new solace.PublisherFlowProperties({enabled: true});
```

The actual method calls to create and send persistent messages to a queue is like for direct messages in the publish/subscribe tutorial. The differences are that:
* a QUEUE type destination is created and used; and
* the delivery mode is set to PERSISTENT.

```JavaScript
var messageText = 'Sample Message';
var message = solace.SolclientFactory.createMessage();
message.setDestination(new solace.Destination(producer.queueName, solace.DestinationType.QUEUE));
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

Receiving persistent messages is different from the direct messaging case described in the the publish/subscribe tutorial.

To receive persistent messages, a `SubscriberFlow` object needs to be created and connected so it will bind to the destination queue and can start receiving messages.

```JavaScript
consumer.destination = new solace.Destination(consumer.queueName, solace.DestinationType.QUEUE);
// Create a flow
consumer.flow = consumer.session.createSubscriberFlow(new solace.SubscriberFlowProperties({
    endpoint: {
        destination: consumer.destination,
    },
}));
```

Flow related events will be sent to the event listeners defined for the `SubscriberFlow`. The most important flow events are:

*   `FlowEventName.UP`: the flow has successfully bound to the destination and ready to receive messages
*   `FlowEventName.BIND_FAILED_ERROR`: the flow has not been able to bind to the destination
*   `FlowEventName.DOWN`: a previously active flow is no longer bound to the destination

```JavaScript
// Define flow event listeners
consumer.flow.on(solace.FlowEventName.UP, function () {
    consumer.consuming = true;
    consumer.log('=== Ready to receive messages. ===');
});
consumer.flow.on(solace.FlowEventName.BIND_FAILED_ERROR, function () {
    consumer.consuming = false;
    consumer.log("=== Error: the flow couldn't bind to queue " + consumer.queueName + " ===");
});
consumer.flow.on(solace.FlowEventName.DOWN, function () {
    consumer.consuming = false;
    consumer.log('=== An error happened, the flow is down ===');
});
```

Message received events will be sent to the message listener defined for the flow.

```JavaScript
// Define message event listener
consumer.flow.on(solace.FlowEventName.MESSAGE, function onMessage(message) {
    consumer.log('Received message: "' + message.getBinaryAttachment() + '",' +
        ' details:\n' + message.dump());
});
// Connect the flow
consumer.flow.connect();
```

Note that flows can only be created and connected after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```JavaScript
consumer.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
    consumer.log('=== Successfully connected and ready to start the message consumer. ===');
    consumer.createAndConnectFlow();
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
cd {{ site.baseurl | remove: '/'}}/src/basic-samples
```

### Installing the Node.js API

For a local installation of the API package, run from the current `src/basic-samples` directory:

```
npm install solclientjs
```

### Running the Samples

The samples consist of two separate producer and consumer Node.js applications: `QueueProducer.js` and `QueueConsumer.js`.

The producer application sends one message and exits, the consumer application is running until Ctrl-C is pressed on the console.

**Sample Output**

First run `QueueConsumer.js` in Node.js, giving it following arguments:

```
node QueueConsumer.js <host:port> <client-username> <client-password> <message-vpn>
```

The following is the output of the tutorial’s `QueueConsumer.js` application after it successfully connected to the Solace message router and bound to the queue.  

```bash
$ node QueueConsumer.js 192.168.133.64 testuser passw default
[16:26:05] 
*** Consumer to queue "tutorial/queue" is ready to connect ***
[16:26:05] Connecting to Solace message router using WebSocket transport url ws://vmr-133-64
[16:26:05] Solace message router VPN name: default
[16:26:05] Client username: testuser
[16:26:05] Connecting...
[16:26:05] Press Ctrl-C to exit
[16:26:05] === Successfully connected and ready to start the message consumer. ===
[16:26:05] Starting consumer for queue: tutorial/queue
[16:26:05] === Ready to receive messages. ===
```

Now, run `QueueProducer.js` in Node.js, also specifying the same arguments.

```
node QueueProducer.js <host:port> <client-username> <client-password> <message-vpn>
```

It will connect to the router, publish a message and exit.

The following is the output of the tutorial’s `QueueProducer.js` application after it successfully connected to the Solace message router, published a message and exited.  

```bash
$ node TopicPublisher.js 192.168.133.64 testuser passw default
[16:28:09] 
*** Producer to queue "tutorial/queue" is ready to connect ***
[16:28:09] Connecting to Solace message router using WebSocket transport url ws://192.168.133.64
[16:28:09] Solace message router VPN name: default
[16:28:09] Client username: testuser
[16:28:09] Connecting...
[16:28:10] === Successfully connected and ready to send messages. ===
[16:28:10] Sending message "Sample Message" to queue "tutorial/queue"...
[16:28:10] Message sent.
[16:28:10] Disconnecting from Solace message router...
```

This is the subscriber receiving a message (`QueueConsumer.js`):  

```bash
[16:28:10] Received message: "Sample Message", details:
Destination:                            QUEUE tutorial/queue
Class Of Service:                       COS1
DeliveryMode:                           PERSISTENT
Binary Attachment:                      len=14
  53 61 6d 70 6c 65 20 4d    65 73 73 61 67 65          Sample.Message                               .
```

You have now successfully connected a client, sent persistent messages to a queue and received them from a consumer flow.

If you have any issues sending and receiving a message, check the [Solace community]({{ site.links-community }}){:target="_top"} for answers to common issues.
