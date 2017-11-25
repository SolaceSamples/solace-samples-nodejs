---
layout: tutorials
title: Publish/Subscribe
summary: Learn how to set up pub/sub messaging on a Solace VMR.
icon: I_dev_P+S.svg
---

This tutorial will introduce you to the fundamentals of the Solace Node.js API version 10 or later by connecting a client, adding a topic subscription and sending a message matching this topic subscription. This forms the basis for any publish / subscribe message exchange.

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.
*   You have access to a running Solace message router with the following configuration:
    *   Enabled message VPN
    *   Enabled client username

One simple way to get access to a Solace message router is to start a Solace VMR load [as outlined here]({{ site.docs-vmr-setup }}){:target="_top"}. By default the Solace VMR will run with the `default` message VPN configured and ready for messaging. Going forward, this tutorial assumes that you are using the Solace VMR. If you are using a different Solace message router configuration, adapt the instructions to match your configuration.

## Goals

The goal of this tutorial is to demonstrate the most basic messaging interaction using a Solace message router. This tutorial will show you:

1.  How to build and send a message on a topic
2.  How to subscribe to a topic and receive a message

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

This tutorial depends on you having Solace Node.js API version 10 or later downloaded and available. Here are a few easy ways to get the Node.js API. The instructions in the Running the Samples section assume you're pulling the packages from the `npmjs` public repository. If your environment differs then adjust the instructions appropriately.

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

## Connecting to the Solace message router

In order to send or receive messages, an application must connect a Solace session. The Solace session is the basis for all client communication with the Solace message router.

The `solace.SolclientFactory` is used to create a Solace `Session` from `SessionProperties`. In the example below, `SessionProperties` is created using object initializers.

Then listeners are defined for Session Events of interest and for receiving direct messages, which are explained in the next sections. 

The created session connects to the Solace message router with the `session.connect()` call.

This tutorial’s sample code comes as two separate applications: one (with the "publisher" object) publishes messages to a specific topic, and the other (with the "subscriber" object) subscribes to messages on that topic and receives the messages.

The following is an example of a session creating and connecting to the Solace message router for the subscriber. The publisher's code will be the same except for that it doesn't require a message event listener.

```javascript
// create session
subscriber.session = solace.SolclientFactory.createSession({
    // solace.SessionProperties
    url:      hosturl,
    vpnName:  vpn,
    userName: username,
    password: pass,
});
// define session event listeners
    /*...see section Session Events...*/
// define message event listener
    /*...see section Receiving a message...*/
// connect the session
try {
    subscriber.session.connect();
} catch (error) {
    subscriber.log(error.toString());
}
```

At this point your Node.js application is connected as a client to the Solace message router. You can use SolAdmin to view this client connection and related details.

## Session Events

The Solace Node.js API communicates changes in status and results of connect and subscription calls through emitting session events with certain event names.

It is necessary to wire your application logic to events through listeners to take appropriate action. The most important events are:

*   `SessionEventCode.UP_NOTICE`: success connecting session to the Solace message router
*   `SessionEventCode.CONNECT_FAILED_ERROR`: unable to connect to the Solace message router
*   `SessionEventCode.DISCONNECTED`: session was disconnected from the Solace message router
*   `SessionEventCode.SUBSCRIPTION_OK`: subscription to a topic was successfully created on the Solace message router

This is how event listeners can be defined in the sample publisher:

```javascript
// define session event listeners
publisher.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
    publisher.log('=== Successfully connected and ready to publish messages. ===');
    publisher.publish();
    publisher.exit();
});
publisher.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
    publisher.log('Connection failed to the message router: ' + sessionEvent.infoStr +
        ' - check correct parameter values and connectivity!');
});
publisher.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
    publisher.log('Disconnected.');
    if (publisher.session !== null) {
        publisher.session.dispose();
        publisher.session = null;
    }
});
```

Note that the application logic can be triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```javascript
publisher.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
    publisher.log('=== Successfully connected and ready to publish messages. ===');
    publisher.publish();
    publisher.exit();
});
```

On the subscriber side we also might want to implement reaction to subscription error and to subscription added or removed:

```javascript
// define session event listeners
/*...SNIP...*/
subscriber.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, function (sessionEvent) {
    subscriber.log('Cannot subscribe to topic: ' + sessionEvent.correlationKey);
});
subscriber.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, function (sessionEvent) {
    if (subscriber.subscribed) {
        subscriber.subscribed = false;
        subscriber.log('Successfully unsubscribed from topic: ' + sessionEvent.correlationKey);
    } else {
        subscriber.subscribed = true;
        subscriber.log('Successfully subscribed to topic: ' + sessionEvent.correlationKey);
        subscriber.log('=== Ready to receive messages. ===');
    }
});
```

The subscriber application logic is also triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```javascript
subscriber.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
    subscriber.log('=== Successfully connected and ready to subscribe. ===');
    subscriber.subscribe();
});
```

See `solace.SessionEventCode` in the [Node.js API Reference]({{ site.docs-api-reference }}){:target="_top"} for the full list of session event codes.

## Receiving a message

This tutorial uses “Direct” messages which are at most once delivery messages. So first, let’s create a listener and express interest in the messages by subscribing to a Solace topic. Then you can look at publishing a matching message and see it received.

![]({{ site.baseurl }}/images/pub-sub-receiving-message-300x134.png)

With a subscriber session created in the previous step, we declare a message event listener.

```javascript
// define session event listeners
    /*...see section Session Events...*/
// define message event listener
subscriber.session.on(solace.SessionEventCode.MESSAGE, function (message) {
    subscriber.log('Received message: "' + message.getBinaryAttachment() + '", details:\n' + message.dump());
        '", details:\n' + message.dump());
});
// connect the session
```

When a message is received, this listener is called with the message as parameter.

You must subscribe to a topic in order to express interest in receiving messages. This tutorial uses the topic _“tutorial/topic”_.

```javascript
subscriber.subscribe = function () {
/*...SNIP...*/
    try {
        subscriber.session.subscribe(
            solace.SolclientFactory.createTopic("tutorial/topic"),
            true,
            "tutorial/topic",
            10000
        );
    } catch (error) {
        subscriber.log(error.toString());
    }
/*...SNIP...*/
}
```

Notice parameters to the session `subscribe` function.

*   __The first parameter__ is the subscription topic.
*   __The second (boolean) parameter__ specifies whether a corresponding event will be generated when the subscription is added successfully.
*   __The third parameter__ is the correlation key. This parameters value will be returned to the `SUBSCRIPTION_OK` session event listener for as the `correlationKey` property of the event: `event.correlationKey`.
*   __The fourth parameter__ is the function call timeout. The timeout sets the limit in milliseconds the `subscribe` function is allowed to block the execution thread. If this limit is reached and the subscription is still not added, then an exception is thrown.

After the subscription is successfully added the subscriber is ready to receive messages and nothing happens until a message is received.

## Sending a message

Now it is time to send a message to the waiting consumer. 

![]({{ site.baseurl }}/images/pub-sub-receiving-message-300x134.png)

### Creating and sending the message

To send a message, you must create a message and a topic type destination. Both of these are created from the `solace.SolclientFactory`.

This tutorial uses “Direct” messages which are at most once delivery messages and will send a message with Text contents “Sample Message”.

This is how it is done in the sample publisher code:

```javascript
var messageText = 'Sample Message';
var message = solace.SolclientFactory.createMessage();
message.setDestination(solace.SolclientFactory.createTopicDestination(publisher.topicName));
message.setBinaryAttachment(messageText);
message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
publisher.log('Publishing message "' + messageText + '" to topic "' + publisher.topicName + '"...');
if (publisher.session !== null) {
    try {
        publisher.session.send(message);
        publisher.log('Message published.');
    } catch (error) {
        publisher.log(error.toString());
    }
} else {
    publisher.log('Cannot publish because not connected to Solace message router.');
}
```

At this point a message to the Solace message router has been sent and your waiting consumer will have received the message and printed its contents to the Node.js console.

## Summarizing

The full source code for this example is available in [GitHub]({{ site.repository }}){:target="_blank"}. If you combine the example source code shown above results in the following source:

*   [TopicPublisher.js]({{ site.repository }}/blob/master/src/basic-samples/TopicPublisher.js)
*   [TopicSubscriber.js]({{ site.repository }}/blob/master/src/basic-samples/TopicSubscriber.js)

### Getting the Source

Clone the GitHub repository containing the Solace samples.

```
git clone {{ site.repository }}
cd {{ site.baseurl | remove: '/'}}
```

### Installing the Node.js API

For a local installation of the API package, run from the current `{{ site.baseurl | remove: '/'}}` directory:

```
npm install solclientjs@">=10.0.0"
```

### Running the Samples

The samples consist of two separate publisher and subscriber Node.js applications in the `/src/basic-samples` directory: `TopicPublisher.js` and `TopicSubsciber.js`.

The publisher application publishes one message and exits, the subscriber application is running until Ctrl-C is pressed on the console.

**Sample Output**

First run `TopicSubscriber.js` in Node.js, giving it following arguments:

```
node TopicSubscriber.js <protocol://host:port> <client-username>@<message-vpn> <client-password>
```

The following is the output of the tutorial’s `TopicSubscriber.js` application after it successfully connected to the Solace message router and subscribed to the subscription topic.  

```bash
$ node TopicSubscriber.js ws://192.168.133.64 testuser@default passw
[15:38:11]
*** Subscriber to topic "tutorial/topic" is ready to connect ***
[15:38:11] Connecting to Solace message router using url: ws://192.168.133.64
[15:38:11] Client username: testuser
[15:38:11] Solace message router VPN name: default
[15:38:11] Press Ctrl-C to exit
[15:38:11] === Successfully connected and ready to subscribe. ===
[15:38:11] Subscribing to topic: tutorial/topic
[15:38:11] Successfully subscribed to topic: tutorial/topic
[15:38:11] === Ready to receive messages. ===
```

Now, run `TopicPublisher.js` in Node.js, also specifying the same arguments.

```
node TopicPublisher.js <protocol://host:port> <client-username>@<message-vpn> <client-password>
```

It will connect to the router, publish a message and exit.

The following is the output of the tutorial’s `TopicPublisher.js` application after it successfully connected to the Solace message router, published a message and exited.  

```bash
$ node TopicPublisher.js ws://192.168.133.64 testuser@default passw
[15:38:18]
*** Publisher to topic "tutorial/topic" is ready to connect ***
[15:38:18] Connecting to Solace message router using url: ws://192.168.133.64
[15:38:18] Client username: testuser
[15:38:18] Solace message router VPN name: default
[15:38:19] === Successfully connected and ready to publish messages. ===
[15:38:19] Publishing message "Sample Message" to topic "tutorial/topic"...
[15:38:19] Message published.
[15:38:19] Disconnecting from Solace message router...
[15:38:19] Disconnected.
```

This is the subscriber receiving a message (`TopicSubscriber.js)`:  

```bash
[15:38:19] Received message: "Sample Message", details:
Destination:                            [Topic tutorial/topic]
Class Of Service:                       COS1
DeliveryMode:                           DIRECT
Expiration:                             0 (Wed Dec 31 1969 19:00:00 GMT-0500 (Eastern Standard Time))
Binary Attachment:                      len=14
  53 61 6d 70 6c 65 20 4d    65 73 73 61 67 65          Sample.Message
```

With that you now know how to successfully implement publish-subscribe message exchange pattern using Direct messages.

If you have any issues publishing and receiving a message, check the [Solace community]({{ site.links-community }}){:target="_top"} for answers to common issues seen.
