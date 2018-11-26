---
layout: tutorials
title: Confirmed Delivery
summary: Learn how to confirm that your messages are received by a Solace message router.
icon: I_dev_confirm.svg
links:
    - label: ConfirmedPublish.js
      link: /blob/master/src/basic-samples/ConfirmedPublish.js
---

This tutorial builds on the basic concepts introduced in [Persistence with Queues]({{ site.baseurl }}/persistence-with-queues) tutorial and will show you how to properly process publisher acknowledgements. Once an acknowledgement for a message has been received and processed, you have confirmed your persistent messages have been properly accepted by the Solace message router and therefore can be guaranteed of no message loss.

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.
*   You have access to Solace messaging with the following configuration details:
    *   Connectivity information for a Solace message-VPN
    *   Enabled client username and password

One simple way to get access to Solace messaging quickly is to create a messaging service in Solace Cloud [as outlined here]({{ site.links-solaceCloud-setup}}){:target="_top"}. You can find other ways to get access to Solace messaging below.


## Goals

The goal of this tutorial is to understand the following:

*  How to properly handle guaranteed message acknowledgements on message send.

{% include_relative assets/solaceMessaging.md %}


## Overview

In order to send guaranteed messages to a Solace message router with no chance of message loss, it is absolutely necessary to properly process the acknowledgements that come back from the Solace message router. These acknowledgements will let you know if the message was accepted by the Solace message router or if it was rejected. If it was rejected, the acknowledgement will also contain exact details of why. For example, you may not have permission to send guaranteed messages or the queue destination may not exist etc.

In order to properly handle message acknowledgements it is also important to know which message is being acknowledged. In other words, applications often need some application context along with the acknowledgement from the Solace message router to properly process the business logic on their end. The Solace Node.js API enables this through emitting a session event called `ACKNOWLEDGED_MESSAGE` when a message is successfully acknowledged. Similarly, the session event `REJECTED_MESSAGE_ERROR` is emitted in case of an error.
This allows applications to attach a correlation object on message send and this correlation object is then passed to the event listeners implemented for above events. This allows applications to easily pass the application context to the acknowledgement, enabling proper correlation of messages sent and acknowledgements received.

For the purposes of this tutorial, we will track message context using the following simple object. It will keep track of the application assigned message sequence number.

```JavaScript
const correlationKey = {
    name: "MESSAGE_CORRELATIONKEY",
    id: sequenceNr,
};
```

{% include_relative assets/solaceApi.md %}

## Implementing Confirmed Delivery

This tutorial’s sample application will send guaranteed messages to a durable queue pre-configured on the Solace message router. You can use SolAdmin or SEMP to create a durable queue. This tutorial assumes that the queue named `tutorial/queue` has been created.

The structure of the code is similar to the Persistence with Queues tutorial's Queue Producer with the additions of several messages being sent and the acknowledgements logged for each message that comes back from the Solace message router.

The following sections from the [Persistence with Queues]({{ site.baseurl }}/persistence-with-queues) tutorial are applicable here, refer to them for all the detailed descriptions.

* Prerequisite: Creating a Durable Queue on the Solace message router
* Loading and Initializing Solace Node.js API
* Connecting to the Solace message router
* Session Events
* Sending a message to a queue

### Configuring Per-Message publisher acknowledge event mode

To confirm successful delivery of each published guaranteed message to the message router, set "Per-Message" publisher acknowledgement so the application receives an acknowledgement event for every message. To learn more about publisher acknowledge event modes refer to the [Customer Documentation - Acknowledging Published Messages]({{ site.docs-ack-pub-msgs }}){:target="_top"}.

Because the guaranteed message publisher is embedded in the `Session` object, configure the `publisherProperties` property of the `SessionProperties` which is used when creating the session. Specifically, set the `acknowledgeMode` of the `publisherProperties`:

```javascript
// create session
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
```

### Adding Message Correlation on Send

Below is the loop sending several messages, passing a message sequence number so messages can be easily distinguished.

```javascript
producer.numOfMessages = 10;
producer.sendMessages = function () {
    if (producer.session !== null) {
        for (var i = 1; i <= producer.numOfMessages; i++) {
            producer.sendMessage(i);
        }
    } else {
        producer.log('Cannot send messages because not connected to Solace message router.');
    }
}
```

Adding a message correlation object to allow an application to easily correlate acknowledgements is accomplished using the `message.setCorrelationKey()` method where you pass in the object you want returned to your application in the acknowledgement event listener. So after augmenting the `producer.sendMessage()` code, you’re left with the following:

```javascript
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
    } catch (error) {
        producer.log(error.toString());
    }
};
```

This will create a correlation object, add it to a global list for later processing and then add it to the Solace message prior to sending.

### Processing the Solace Acknowledgement

To process the acknowledgements with correlation, you must implement event listeners for the following session events:

*   `SessionEventCode.ACKNOWLEDGED_MESSAGE`: the delivery of a message from the application has been confirmed by the Solace message router
*   `SessionEventCode.REJECTED_MESSAGE_ERROR`: there has been an error in the delivery of a message to the Solace message router

The following code shows you a basic acknowledgement processing event listener that is reporting results, counting and exiting when acknowledgement has been received for all the messages.

```javascript
// create session
/*...SNIP...*/
// define session event listeners
/*...SNIP...*/
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
/*...SNIP...*/
// connect the session
try {
    producer.session.connect();
} catch (error) {
    producer.log(error.toString());
}
```

## Summarizing

Combining the example source code shown above results in the following source code files:

<ul>
{% for item in page.links %}
<li><a href="{{ site.repository }}{{ item.link }}" target="_blank">{{ item.label }}</a></li>
{% endfor %}
</ul>

### Getting the Source

Clone the GitHub repository containing the Solace samples.

```
git clone {{ site.repository }}
cd {{ site.repository | split: '/' | last}}
```

Note: the code in the `master` branch of this repository depends on Solace Node.js API version 10 or later. If you want to work with an older version clone the branch that corresponds your version.

### Installing the Node.js API

For a local installation of the API package, run from the current `{{ site.baseurl | remove: '/'}}` directory:

```
npm install
```

### Running the Sample

The sample application is in the `/src/basic-samples` directory: `ConfirmedPublish.js`.

It will send 10 messages, wait for the delivery confirmation for all messages then exit. The `QueueConsumer` sample application from the Persistence with Queues tutorial can be used to receive and display the sent messages.

**Sample Output**

First run `ConfirmedPublish.js` in Node.js, giving it following arguments:

```
node ConfirmedPublish.js <protocol://host:port> <client-username>@<message-vpn> <client-password>
```

The following is the output of the tutorial’s `ConfirmedPublish.js` application after it successfully connected to the Solace message router, sent 10 messages and received confirmation of delivery for all.  

```bash
$ node ConfirmedPublish.js ws://192.168.133.64 testuser@default passw
[16:21:22]
*** Producer to queue "tutorial/queue" is ready to connect ***
[16:21:22] Connecting to Solace message router using url: ws://192.168.133.64
[16:21:22] Client username: testuser
[16:21:22] Solace message router VPN name: default
[16:21:22] === Successfully connected and ready to send messages. ===
[16:21:22] Message #1 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":1}
[16:21:22] Message #2 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":2}
[16:21:22] Message #3 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":3}
[16:21:22] Message #4 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":4}
[16:21:22] Message #5 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":5}
[16:21:22] Message #6 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":6}
[16:21:22] Message #7 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":7}
[16:21:22] Message #8 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":8}
[16:21:22] Message #9 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":9}
[16:21:22] Message #10 sent to queue "tutorial/queue", correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":10}
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":1} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":2} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":3} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":4} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":5} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":6} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":7} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":8} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":9} confirmed.
[16:21:23] Delivery of message with correlation key = {"name":"MESSAGE_CORRELATIONKEY","id":10} confirmed.
[16:21:23] Disconnecting from Solace message router...
[16:21:23] Disconnected.
```

You have now successfully sent guaranteed messages to a Solace router and confirmed its receipt by correlating the acknowledgement.

If you have any issues sending and receiving a message, check the [Solace community]({{ site.links-community }}){:target="_top"} for answers to common issues.
