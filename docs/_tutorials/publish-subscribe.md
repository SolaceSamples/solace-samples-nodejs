---
layout: tutorials
title: Publish/Subscribe
summary: Learn to publish and subscribe to messages.
icon: I_dev_P+S.svg
links:
    - label: TopicPublisher.js
      link: /blob/master/src/TopicPublisher.js
    - label: TopicSubscriber.js
      link: /blob/master/src/TopicSubscriber.js
---

This tutorial will introduce you to the fundamentals of the Solace API by connecting a client, adding a topic subscription and sending a message matching this topic subscription. This forms the basis for any publish / subscribe message exchange.

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.
*   You have access to Solace messaging with the following configuration details:
    *   Connectivity information for a Solace message-VPN
    *   Enabled client username and password

{% if jekyll.environment == 'solaceCloud' %}
One simple way to get access to Solace messaging quickly is to create a messaging service in Solace Cloud [as outlined here]({{ site.links-solaceCloud-setup}}){:target="_top"}. You can find other ways to get access to Solace messaging on the [home page]({{ site.baseurl }}/) of these tutorials.
{% else %}
One simple way to get access to a Solace message router is to start a Solace VMR load [as outlined here]({{ site.docs-vmr-setup }}){:target="_top"}. By default the Solace VMR will with the “default” message VPN configured and ready for guaranteed messaging. Going forward, this tutorial assumes that you are using the Solace VMR. If you are using a different Solace message router configuration adapt the tutorial appropriately to match your configuration.
{% endif %}

## Goals

The goal of this tutorial is to demonstrate the most basic messaging interaction using Solace. This tutorial will show you:

1.  How to build and send a message on a topic
2.  How to subscribe to a topic and receive a message

{% if jekyll.environment == 'solaceCloud' %}
  {% include solaceMessaging-cloud.md %}
{% else %}
    {% include solaceMessaging.md %}
{% endif %}  
{% include solaceApi.md %}

## Connecting to the Solace message router

In order to send or receive messages, an application must connect a Solace session. The Solace session is the basis for all client communication with the Solace message router.

The `solace.SolclientFactory` is used to create Solace session from a set of `SessionProperties`.

Notice the two mandatory callbacks in the `createSession()` call. The first one (of `solace.MessageRxCBInfo` type) is the message event callback. It receives messages. The second one (of `solace.SessionEventCBInfo` type) is the session event callback. It receives events indicating the Solace session connected, disconnected, ready for publishing messages or subscribing to a topic or encountered an error.

The created session connects to the Solace message router with the `session.connect()` call.

This tutorial’s sample code comes as two separated applications: one (with the “publisher” object) publishes messages to a specific topic and the other (with the “subscriber” object) subscribes to messages on that topic, and receives the messages.

The following is an example of session creating and connecting to the Solace message router for the publisher. The subscriber’s code will be exactly the same.

```javascript
var sessionProperties = new solace.SessionProperties();
sessionProperties.url = 'ws://' + host;
sessionProperties.vpnName = vpnname;
sessionProperties.userName = username;
sessionProperties.password = password;
publisher.session = solace.SolclientFactory.createSession(
    sessionProperties,
    new solace.MessageRxCBInfo(function (session, message) {
        publisher.messageEventCb(session, message);
    }, publisher),
    new solace.SessionEventCBInfo(function (session, event) {
        publisher.sessionEventCb(session, event);
    }, publisher)
);
try {
    publisher.session.connect();
} catch (error) {
    publisher.log(error.toString());
}
```

At this point your Node.js application is connected as a client to the Solace message router. You can use SolAdmin to view this client connection and related details.

## Session Events

The Solace Systems Node.js API communicates changes in status and results of connect and subscription calls through the session callback of type `solace.SessionEventCBInfo`.

It is necessary to wire your application logic to events from this callback. The most important events are:

*   `SessionEventCode.UP_NOTICE`: success connecting session to the Solace message router
*   `SessionEventCode.DISCONNECTED`: session was disconnected from the Solace message router
*   `SessionEventCode.SUBSCRIPTION_OK`: subscription to a topic was successfully created on the Solace message router

This is how this callback can be implemented in the sample publisher:

```javascript
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
```

The application logic can be triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```javascript
if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
    publisher.log('=== Successfully connected and ready to publish messages. ===');
    publisher.publish();
    publisher.exit();
    /*...SNIP...*/
}
```

On the subscriber side we also might want to implement reaction to subscription error and to subscription added or removed:

```javascript
subscriber.sessionEventCb = function (session, event) {
    subscriber.log(event.toString());
    if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
        subscriber.log('=== Successfully connected and ready to subscribe. ===');
        subscriber.subscribe();
    } else if (event.sessionEventCode === solace.SessionEventCode.CONNECTING) {
        subscriber.log('Connecting...');
        subscriber.subscribed = false;
    } else if (event.sessionEventCode === solace.SessionEventCode.DISCONNECTED) {
        subscriber.log('Disconnected.');
        subscriber.subscribed = false;
        if (subscriber.session !== null) {
            subscriber.session.dispose();
            subscriber.session = null;
        }
    } else if (event.sessionEventCode === solace.SessionEventCode.SUBSCRIPTION_ERROR) {
        subscriber.log('Cannot subscribe to topic: ' + event.correlationKey);
    } else if (event.sessionEventCode === solace.SessionEventCode.SUBSCRIPTION_OK) {
        if (subscriber.subscribed) {
            subscriber.subscribed = false;
            subscriber.log('Successfully unsubscribed from topic: ' + event.correlationKey);
        } else {
            subscriber.subscribed = true;
            subscriber.log('Successfully subscribed to topic: ' + event.correlationKey);
            subscriber.log('=== Ready to receive messages. ===');
        }
    }
};
```

Notice how the subscriber application logic is also triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```javascript
if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
        subscriber.log('=== Successfully connected and ready to subscribe. ===');
        subscriber.subscribe();
        /*...SNIP...*/
}
```

See the [Solace Systems Web Messaging API “Handling session events”]({{ site.docs-session-events }}){:target="_top"} documentation for the full list of session event codes.

## Receiving a message

This tutorial uses “Direct” messages which are at most once delivery messages. So first, let’s express interest in the messages by subscribing to a Solace topic. Then you can look at publishing a matching message and see it received.

![]({{ site.baseurl }}/images/pub-sub-receiving-message-300x134.png)

With a subscriber session created and connected in the previous step, we declared the message event callback of `solace.MessageRxCBInfo` type that redirects its call to the `messageEventCb` function.

```javascript
subscriber.messageEventCb = function (session, message) {
    subscriber.log('Received message: "' + message.getSdtContainer().getValue() + '"');
};
/*...SNIP...*/
subscriber.session = solace.SolclientFactory.createSession(
    sessionProperties,
    new solace.MessageRxCBInfo(function (session, message) {
        subscriber.messageEventCb(session, message);
    }, subscriber),
    /*...SNIP...*/
);
```

When a message is received, this `messageEventCb` function is called with the message as one of the parameters.

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
*   __The second (Boolean) parameter__ specifies whether a corresponding events will be generated when the subscription is added successfully.
*   __The third parameter__ is the correlation key. This parameters value will be returned to the session event callback as the `correlationKey` property of the event `event.correlationKey`.
*   __The last, fourth parameter__ is the function call timeout. The timeout sets the limit in milliseconds the `subscribe` function is allowed to block the execution thread. If this limit is reached and the subscription is still not added, then an exception is thrown.

After the subscription is successfully added the subscriber is ready to receive messages and nothing happens until a message is received.

## Sending a message

Now it is time to send a message to the waiting consumer.

![]({{ site.baseurl }}/images/pub-sub-receiving-message-300x134.png)

### Creating and sending the message

To send a message, you must create a message and a topic. Both of these are created from the `solace.SolclientFactory`.

This tutorial uses “Direct” messages which are at most once delivery messages and will send a message with Text contents “Sample Message”.

This is how it is done in the sample publisher code:

```javascript
var messageText = 'Sample Message';
var message = solace.SolclientFactory.createMessage();
publisher.log('Publishing message "' + messageText + '" to topic "tutorial/topic"...');
message.setDestination(solace.SolclientFactory.createTopic("tutorial/topic"));
message.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, messageText));
message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
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

This tutorial is available in GitHub.  To get started, clone the GitHub repository containing the Solace samples.

<ul>
{% for item in page.links %}
<li><a href="{{ site.repository }}{{ item.link }}" target="_blank">{{ item.label }}</a></li>
{% endfor %}
</ul>

### Running samples

The samples consist of two separate publisher and subscriber Node.js applications: `TopicPublisher.js` and `TopicSubsciber.js`.

Each application is bootstrapped by calling the `run` function with four application arguments that is expected to be the Solace message router IP address with its web connection port, the vpn name, the client username, and the client password.

In the publisher `TopicPublish.js`:

```javascript
var publisher = new TopicPublisher(solace, 'tutorial/topic');
var host = process.argv.slice(2)[0];
var vpnname = split[1];
var username = split[0];
var password = process.argv.slice(4)[0];
publisher.run(host, vmrname, username, password);
```

In the subscriber `TopicSubscribe.js`:

```javascript
var subscriber = new TopicSubscriber(solace, 'tutorial/topic');
var host = process.argv.slice(2)[0];
var vpnname = split[1];
var username = split[0];
var password = process.argv.slice(4)[0];
subscriber.run(host, vmrname, username, password);
```

Both applications logic is triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event as demonstrated above.

The publisher application publishes one message and exits, the subscriber application is running until Ctrl-C is pressed on the console.

### Sample Output

First run `TopicSubscriber.js` in Node.js, giving it arguments for the router’s connection properties (<host> <username>@<vpnname> <password>)

The following is a screenshot of the tutorial’s `TopicSubscriber.js` application after it successfully connected to the Solace message router and subscribed to the subscription topic.  

![]({{ site.baseurl }}/images/nodejs-pubsub-img-1.png)

Now, run `TopicPublisher.js` in Node.js, also specifying the router’s connection properties

It will connect to the router, publish a message and exit.

The following is a screenshot of the tutorial’s `TopicPublisher.js` application after it successfully connected to the Solace message router, published a message and exited.  

![]({{ site.baseurl }}/images/nodejs-pubsub-img-2.png)

This is the subscriber receiving a message (`TopicSubscriber.js)`:  

![]({{ site.baseurl }}/images/nodejs-pubsub-img-3.png)

With that you now know how to successfully implement publish-subscribe message exchange pattern using Direct messages.

If you have any issues publishing and receiving a message, check the [Solace community Q&A]({{ site.links-community }}){:target="_top"} for answers to common issues seen.
