---
layout: tutorials
title: Request/Reply
summary: Learn how to set up request/reply messaging.
icon: I_dev_R+R.svg
---

This tutorial outlines both roles in the request-response message exchange pattern. It will show you how to act as the client by creating a request, sending it and waiting for the response. It will also show you how to act as the server by receiving incoming requests, creating a reply and sending it back to the client. It builds on the basic concepts introduced in [publish/subscribe tutorial]({{ site.baseurl }}/publish-subscribe).

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.
*   You have access to a running Solace message router with the following configuration:
    *   Enabled message VPN
    *   Enabled client username

One simple way to get access to a Solace message router is to start a Solace VMR load [as outlined here]({{ site.docs-vmr-setup }}){:target="_top"}. By default the Solace VMR will run with the “default” message VPN configured and ready for messaging. Going forward, this tutorial assumes that you are using the Solace VMR. If you are using a different Solace message router configuration, adapt the instructions to match your configuration.

The build instructions in this tutorial assume you are using a Linux shell. If your environment differs, adapt the instructions.

## Goals

The goal of this tutorial is to understand the following:

*   On the requestor side:
    1.  How to create a request
    2.  How to receive a response
    3.  How to use the Solace API to correlate the request and response
*   On the replier side:
    1.  How to detect a request expecting a reply
    2.  How to generate a reply message

## Overview

Request-reply messaging is supported by the Solace message router for all delivery modes. For direct messaging, the Solace APIs provide the `Requestor` object for convenience. This object makes it easy to send a request and wait for the reply message. It is a convenience object that makes use of the API provided “inbox” topic that is automatically created for each Solace client and automatically correlates requests with replies using the message correlation ID. (See Message Correlation below for more details). On the reply side another convenience method enables applications to easily send replies for specific requests. Direct messaging request reply is the delivery mode that is illustrated in this sample.

### Message Correlation

For request-reply messaging to be successful it must be possible for the requestor to correlate the request with the subsequent reply. Solace messages support two fields that are needed to enable request-reply correlation. The reply-to field can be used by the requestor to indicate a Solace Topic where the reply should be sent. A natural choice for this is often the unique `P2PINBOX_IN_USE` topic which is an auto-generated unique topic per client which is accessible as a session property. The second requirement is to be able to detect the reply message from the stream of incoming messages. This is accomplished using the `correlation-id` field. This field will transit the Solace messaging system unmodified. Repliers can include the same `correlation-id` in a reply message to allow the requestor to detect the corresponding reply. The figure below outlines this exchange.

![]({{ site.baseurl }}/images/Request-Reply_diagram-1.png)

For direct messages however, this is simplified through the use of the `Requestor` object as shown in this sample.

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

## Implementing Request/Reply

This tutorial’s sample code comes as two separated applications: one (with the “requestor” object) send requests to a specific topic and the other (with the “replier” object) subscribes to requests on that topic, receives the requests and replies on them.

The structure of the requestor application is similar to the publish/subscribe tutorial's topic publisher. Here instead of simply publishing a message, a request will be sent.

The structure of the replier application is similar to the topic subscriber. It differs in that when receiving the request it doesn't only log the message but sends a reply.

The followings are exactly the same as in the [publish/subscribe tutorial]({{ site.baseurl }}/publish-subscribe), refer to it for all the detailed descriptions.
    
* Loading and Initializing Solace Node.js API
* Connecting to the Solace message router
* Session Events

### Making a request

First let’s look at the requestor. This is the application that will send the initial request message and wait for the reply.

![]({{ site.baseurl }}/images/Request-Reply_diagram-2.png)

The requestor must create a message and the topic to send the message to:

```javascript
var requestText = 'Sample Request';
var request = solace.SolclientFactory.createMessage();
requestor.log('Sending request "' + requestText + '" to topic "' + requestor.topicName + '"...');
request.setDestination(solace.SolclientFactory.createTopicDestination(requestor.topicName));
request.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, requestText));
request.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
```

Now the request can be sent. Notice callbacks `replyReceivedCb` and `requestFailedCb`. These are functions that will be called when a reply message is received (`replyReceivedCb`) or sending of the request is failed (`requestFailedCb`).

```javascript
try {
    requestor.session.sendRequest(
        request,
        5000, // 5 seconds timeout for this operation
        function (session, message) {
            requestor.replyReceivedCb(session, message);
        },
        function (session, event) {
            requestor.requestFailedCb(session, event);
        },
        null // not providing correlation object
    );
} catch (error) {
    requestor.log(error.toString());
}
```

### Replying to a request

Now it is time to receive the request and generate an appropriate reply.

![]({{ site.baseurl }}/images/Request-Reply_diagram-3.png)

Just as with previous tutorials, you still need to connect a session and subscribe to the topics that requests are sent on (the request topic). The following is an example of such reply.

```javascript
replier.reply = function (message) {
    if (replier.session !== null) {
        var reply = solace.SolclientFactory.createMessage();
        var ba = message.getBinaryAttachment();
        var replyText = message.getSdtContainer().getValue() + " - Sample Reply";
        reply.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, replyText));
        replier.session.sendReply(message, reply);
        replier.log('Replied.');
    } else {
        replier.log('Cannot reply: not connected to Solace message router.');
    }
};
```

The replier.reply is the function that is called from the replier message event listener defined for `replier.session`:

```javascript
// define message event listener
replier.session.on(solace.SessionEventCode.MESSAGE, function (message) {
    try {
        replier.reply(message);
    } catch (error) {
        replier.log(error.toString());
    }
});
```

### Receiving the Reply Message

All that’s left is to receive and process the reply message as it is received at the requestor or report a failure to send the request:

```javascript
requestor.replyReceivedCb = function (session, message) {
	requestor.log('Received reply: "' + message.getSdtContainer().getValue() + '"');
};

requestor.requestFailedCb = function (session, event) {
	requestor.log('Request failure: ' + event.toString());
};
```

## Summarizing

The full source code for this example is available in [GitHub]({{ site.repository }}){:target="_blank"}. If you combine the example source code shown above results in the following source:

*   [BasicRequestor.js]({{ site.repository }}/blob/master/src/basic-samples/BasicRequestor.js)
*   [BasicReplier.js]({{ site.repository }}/blob/master/src/basic-samples/BasicReplier.js)

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

The samples consist of two separate requestor and replier Node.js applications in the `/src/basic-samples` directory: _(BasicRequestor.js_ and _BasicReplier.js)_.

The publisher application publishes one message and exits, the subscriber application is running until Ctrl-C is pressed on the console.

**Sample Output**

First run `BasicReplier.js` in Node.js, giving it following arguments:

```
node _BasicReplier.js <host:port> <client-username> <client-password> <message-vpn>
```

The following is the output of the tutorial’s _BasicReplier.js_ application after it successfully connected to the Solace message router and subscribed to the request topic.

```bash
$ node BasicReplier.js ws://192.168.133.64 testuser@default passw
[14:52:10]
*** replier to topic "tutorial/topic" is ready to connect ***
[14:52:10] Connecting to Solace message router using url: ws://192.168.133.64
[14:52:10] Client username: testuser
[14:52:10] Solace message router VPN name: default
[14:52:10] Press Ctrl-C to exit
[14:52:10] === Successfully connected and ready to subscribe to request topic. ===
[14:52:10] Subscribing to topic: tutorial/topic
[14:52:10] Successfully subscribed to request topic: tutorial/topic
[14:52:10] === Ready to receive requests. ===
```

Now, run _BasicRequestor.js_ in Node.js, also specifying the same arguments.

It will connect to the router, send a request, receive a reply and exit.

The following is the output of the tutorial’s _BasicRequestor.js_ application after it successfully connected to the Solace message router, sent a request, received a reply and exited.

```bash
$ node BasicRequestor.js ws://192.168.133.64 testuser@default passw
[14:52:16]
*** requestor to topic "tutorial/topic" is ready to connect ***
[14:52:16] Connecting to Solace message router using url: ws://192.168.133.64
[14:52:16] Client username: testuser
[14:52:16] Solace message router VPN name: default
[14:52:16] === Successfully connected and ready to send requests. ===
[14:52:16] Sending request "Sample Request" to topic "tutorial/topic"...
[14:52:16] Received reply: "Sample Request - Sample Reply", details:
Destination:                            [Topic #P2P/v:vmr-133-64/GJxznbpz/solclientjs/nodejs/0623304208/0001/#]
CorrelationId:                          #REQ1
Class Of Service:                       COS1
DeliveryMode:                           DIRECT
Expiration:                             0 (Wed Dec 31 1969 19:00:00 GMT-0500 (Eastern Standard Time))
Reply Message
Binary Attachment:                      len=32
  1c 20 53 61 6d 70 6c 65    20 52 65 71 75 65 73 74    ..Sample.Request
  20 2d 20 53 61 6d 70 6c    65 20 52 65 70 6c 79 00    .-.Sample.Reply.

[14:52:16] Disconnecting from Solace message router...
[14:52:16] Disconnected.
```

This is the replier replying to a request (_BasicReplier.js_):

```bash
[14:52:16] Received message: "Sample Request", details:
Destination:                            [Topic tutorial/topic]
CorrelationId:                          #REQ1
Class Of Service:                       COS1
DeliveryMode:                           DIRECT
Expiration:                             0 (Wed Dec 31 1969 19:00:00 GMT-0500 (Eastern Standard Time))
ReplyTo:                                [Topic #P2P/v:vmr-133-64/GJxznbpz/solclientjs/nodejs/0623304208/0001/#]
Binary Attachment:                      len=17
  1c 11 53 61 6d 70 6c 65    20 52 65 71 75 65 73 74    ..Sample.Request
  00                                                    .

[14:52:16] Replying...
[14:52:16] Replied.
```

With that you now know how to successfully implement request-reply message exchange pattern using Direct messages.

If you have any issues sending and replying a message, check the [Solace community Q&A]({{ site.links-community }}){:target="_top"} for answers to common issues seen.

