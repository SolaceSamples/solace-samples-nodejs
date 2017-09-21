---
layout: tutorials
title: Confirmed Delivery
summary: Learn how to confirm that your messages are received by a Solace message router.
icon: confirmed-delivery.png
---

This tutorial builds on the basic concepts introduced in [Persistence with Queues]({{ site.baseurl }}/persistence-with-queues) tutorial and will show you how to properly process publisher acknowledgements. Once an acknowledgement for a message has been received and processed, you have confirmed your persistent messages have been properly accepted by the Solace message router and therefore can be guaranteed of no message loss.

![confirmed-delivery]({{ site.baseurl }}/images/confirmed-delivery.png)

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

*  How to properly handle persistent message acknowledgements on message send.

## Overview

In order to send fully persistent messages to a Solace message router with no chance of message loss, it is absolutely necessary to properly process the acknowledgements that come back from the Solace message router. These acknowledgements will let you know if the message was accepted by the Solace message router or if it was rejected. If it is rejected, the acknowledgement will also contain exact details of why it was rejected. For example, you may not have permission to send persistent messages or queue destination may not exist etc.

In order to properly handle message acknowledgements it is also important to know which message is being acknowledged. In other words, applications often need some application context along with the acknowledgement from the Solace message router to properly process the business logic on their end. The Solace Node.js API enables this through emitting a session event called `ACKNOWLEDGED_MESSAGE` when a message is successfully acknowledged. Similarly, the session event `REJECTED_MESSAGE_ERROR` is emitted in case of an error.
This allows applications to attach a correlation object on message send and this correlation object is then passed to the event listeners implemented for above events. This allows applications to easily pass the application context to the acknowledgement, handling enabling proper correlation of messages sent and acknowledgements received.

For the purposes of this tutorial, we will track message context using the following simple object. It will keep track of the application assigned message sequence number.

```JavaScript
const correlationKey = {
    name: "MESSAGE_CORRELATIONKEY",
    id: sequenceNr,
};
```

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

This tutorial requires that a physical endpoint resource – a durable queue, associated with the Queue Destination – has been created on the Solace message router.

You can use SolAdmin to create a durable queue. This tutorial assumes that the queue named `tutorial/queue` has been created, the same as used in the Persistence with Queues tutorial.

```************** Note: expand on other options how to create a queue: SEMP, web mgmt **************```

## Implementing Confirmed Delivery

This tutorial’s sample application will send persistent messages to a durable queue configured on the Solace message router and will log the events for the acknowledgements that come back from the Solace message router for each message.

The structure of the code is similar to the Persistence with Queues tutorial's Queue Producer with the additions of several messages being sent and the acknowledgements logged.

The following sections from the [Persistence with Queues]({{ site.baseurl }}/persistence-with-queues) tutorial are applicable here, refer to them for all the detailed descriptions.
    
* Loading and Initializing Solace Node.js API
* Connecting to the Solace message router
* Session Events
* Sending a message to a queue

## Adding Message Correlation on Send

Below is the loop sending several messages, passing a message sequence number so messages can be easily distinguished.

```JavaScript
producer.messageCount = 10;
producer.sendMessages = function () {
    if (producer.session !== null) {
        for (var i = 1; i <= producer.messageCount; i++) {
            producer.sendMessage(i);
        }
    } else {
        producer.log('Cannot send messages because not connected to Solace message router.');
    }
}
```

Adding a message correlation object to allow an application to easily correlate acknowledgements is accomplished using the `message.setCorrelationKey()` method where you pass in the object you want returned to your application in the acknowledgement event listener. So after augmenting the `producer.sendMessage()` code, you’re left with the following:

```JavaScript
producer.sendMessage = function (sequenceNr) {
    var messageText = 'Sample Message';
    var message = solace.SolclientFactory.createMessage();
    message.setDestination(
        solace.SolclientFactory.createDestination(solace.DestinationType.QUEUE, producer.queueName));
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
        producer.log('Message #' + sequenceNr + ' sent to queue "' + producer.queueName +
            '"with correlation key = ' + JSON.stringify(correlationKey));
    } catch (error) {
        producer.log(error.toString());
    }
};
```

This will create a correlation object, add it to a global list for later processing and then add it to the Solace message prior to sending.

## Processing the Solace Acknowledgement

To process the acknowledgements with correlation, you must implement event listeners for the following session events:

*   `SessionEventCode.ACKNOWLEDGED_MESSAGE`: the delivery of a message from the application has been confirmed by the Solace message router
*   `SessionEventCode.REJECTED_MESSAGE_ERROR`: there has been an error in the delivery of a message to the Solace message router

The following code shows you a basic acknowledgement processing event listener that is reporting results, counting and exiting when acknowledgement has been received for all the messages.

```javascript
// create session
publisher.session = solace.SolclientFactory.createSession(sessionProperties);
// define session event listeners
/*...SNIP...*/
producer.session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, function (sessionEvent) {
    producer.log('Delivery of message with correlation key = ' + JSON.stringify(sessionEvent.correlationKey) +
      ' confirmed.');
    producer.messageAckRecvd++;
    if (producer.messageAckRecvd === producer.messageCount) {
        producer.exit();
    }
});
producer.session.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, function (sessionEvent) {
    producer.log('Delivery of message with correlation key = ' + JSON.stringify(sessionEvent.correlationKey) +
        ' rejected, info: ' + sessionEvent.infoStr);
    producer.messageAckRecvd++;
    if (producer.messageAckRecvd === producer.messageCount) {
        producer.exit();
    }
});
/*...SNIP...*/
// connect the session
try {
    subscriber.session.connect();
} catch (error) {
    subscriber.log(error.toString());
}
```

## Summarizing

The full source code for this example is available in [GitHub]({{ site.repository }}){:target="_blank"}. If you combine the example source code shown above results in the following source:

*   [ConfirmedPublish.js]({{ site.repository }}/blob/master/src/basic-samples/ConfirmedPublish.js)

### Getting the Source

Clone the GitHub repository containing the Solace samples.

```
git clone {{ site.repository }}
cd {{ site.baseurl | remove: '/'}}
```

### Installing the Node.js API

For a local installation of the API package, run from the current `src/basic-samples` directory:

```
npm install solclientjs
```

### Running the Samples

The sample application `ConfirmedPublish.js` sends 10 messages, waits for the delivery confirmation for all messages then exits. The `QueueConsumer` sample application from the Persistence with Queues tutorial can be used to receive and display the messages.

**Sample Output**

First run `ConfirmedPublish.js` in Node.js, giving it following arguments:

```
node ConfirmedPublish.js <host:port> <client-username> <client-password> <message-vpn>
```

The following is the output of the tutorial’s `ConfirmedPublish.js` application after it successfully connected to the Solace message router, sent 10 messages and received confirmation of delivery for all.  

```bash
$ node ConfirmedPublish.js 192.168.133.64 testuser passw default
[14:24:54] 
*** Producer to queue "tutorial/queue" is ready to connect ***
[14:24:54] Connecting to Solace message router using WebSocket transport url ws://192.168.133.64
[14:24:54] Solace message router VPN name: default
[14:24:54] Client username: testuser
[14:24:54] Connecting...
[14:24:54] === Successfully connected and ready to send messages. ===
[14:24:54] Message #1 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":1}
[14:24:54] Message #2 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":2}
[14:24:54] Message #3 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":3}
[14:24:54] Message #4 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":4}
[14:24:54] Message #5 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":5}
[14:24:54] Message #6 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":6}
[14:24:54] Message #7 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":7}
[14:24:54] Message #8 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":8}
[14:24:54] Message #9 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":9}
[14:24:54] Message #10 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":10}
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":1} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":2} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":3} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":4} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":5} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":6} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":7} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":8} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":9} confirmed.
[14:24:55] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":10} confirmed.
[14:24:55] Disconnecting from Solace message router...
[14:24:55] Disconnected.

```

You have now successfully sent persistent messages to a Solace router and confirmed its receipt by correlating the acknowledgement.

If you have any issues sending and receiving a message, check the [Solace community]({{ site.links-community }}){:target="_top"} for answers to common issues.