---
layout: tutorials
title: Request/Reply
summary: Learn how to set up request/reply messaging.
icon: I_dev_R+R.svg
links:
    - label: BasicRequestor.js
      link: /blob/master/src/BasicRequestor.js
    - label: BasicReplier.js
      link: /blob/master/src/BasicReplier.js
---

This tutorial outlines both roles in the request-response message exchange pattern. It will show you how to act as the client by creating a request, sending it and waiting for the response. It will also show you how to act as the server by receiving incoming requests, creating a reply and sending it back to the client. It builds on the basic concepts introduced in [publish/subscribe tutorial]({{ site.baseurl }}/publish-subscribe).

## Assumptions

This tutorial assumes the following:

*   You are familiar with Solace [core concepts]({{ site.docs-core-concepts }}){:target="_top"}.
*   You have access to Solace messaging with the following configuration details:
    *   Connectivity information for a Solace message-VPN
    *   Enabled client username and password

{% if jekyll.environment == 'solaceCloud' %}
One simple way to get access to Solace messaging quickly is to create a messaging service in Solace Cloud [as outlined here]({{ site.links-solaceCloud-setup}}){:target="_top"}. You can find other ways to get access to Solace messaging below.
{% else %}
One simple way to get access to a Solace message router is to start a Solace VMR load [as outlined here]({{ site.docs-vmr-setup }}){:target="_top"}. By default the Solace VMR will with the “default” message VPN configured and ready for guaranteed messaging. Going forward, this tutorial assumes that you are using the Solace VMR. If you are using a different Solace message router configuration adapt the tutorial appropriately to match your configuration.
{% endif %}

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

For request-reply messaging to be successful it must be possible for the requestor to correlate the request with the subsequent reply. Solace messages support two fields that are needed to enable request-reply correlation. The reply-to field can be used by the requestor to indicate a Solace Topic where the reply should be sent. A natural choice for this is often the unique `P2PINBOX_IN_USE` topic which is an auto-generated unique topic per client which is accessible as a session property. The second requirement is to be able to detect the reply message from the stream of incoming messages. This is accomplished using the correlation-id field. This field will transit the Solace messaging system unmodified. Repliers can include the same correlation-id in a reply message to allow the requestor to detect the corresponding reply. The figure below outlines this exchange.

![]({{ site.baseurl }}/images/Request-Reply_diagram-1.png)

For direct messages however, this is simplified through the use of the `Requestor` object as shown in this sample.

{% if jekyll.environment == 'solaceCloud' %}
  {% include solaceMessaging-cloud.md %}
{% else %}
    {% include solaceMessaging.md %}
{% endif %}  
{% include solaceApi.md %}

## Connecting to the Solace message router

In order to send or receive messages, an application must connect a Solace session. The Solace session is the basis for all client communication with the Solace message router.

The `solace.SolclientFactory` is used to create Solace session from a set of `SessionProperties`.

Notice the two mandatory callbacks in the `createSession()` call. The first one (of `solace.MessageRxCBInfo` type) is the message event callback. It receives messages. The second one (of `solace.SessionEventCBInfo` type) is the session event callback. It receives events indicating the Solace session connected, disconnected, ready for sending requests or subscribing to a request topic or encountered an error.

The created session connects to the Solace message router with the `session.connect()` call.

This tutorial’s sample code comes as two separated applications: one (with the “requestor” object) send requests to a specific topic and the other (with the “replier” object) subscribes to requests on that topic, receives the requests and replies on them.

The following is an example of session creating and connecting to the Solace message router for the requestor. The replier’s code will be exactly the same.

```javascript
var sessionProperties = new solace.SessionProperties();
sessionProperties.url = 'ws://' + host;
sessionProperties.vpnName = vpnname;
sessionProperties.userName = username;
sessionProperties.password = password;
requestor.session = solace.SolclientFactory.createSession(
    sessionProperties,
    new solace.MessageRxCBInfo(function (session, message) {
        requestor.messageEventCb(session, message);
    }, requestor),
    new solace.SessionEventCBInfo(function (session, event) {
        requestor.sessionEventCb(session, event);
    }, requestor)
);
try {
    requestor.session.connect();
} catch (error) {
    requestor.log(error.toString());
}
```

At this point your Node.js application is connected as a client to the Solace message router. You can use SolAdmin to view this client connection and related details.

## Session Events

The Solace Systems Node.js API communicates changes in status and results of connect and subscription calls through the session callback of type `solace.SessionEventCBInfo`.

It is necessary to wire your application logic to events from this callback. The most important events are:

*   `SessionEventCode.UP_NOTICE`: success connecting session to the Solace message router
*   `SessionEventCode.DISCONNECTED`: session was disconnected from the Solace message router
*   `SessionEventCode.SUBSCRIPTION_OK`: subscription to a topic was successfully created on the Solace message router

This is how this callback can be implemented in the sample requestor:

```javascript
requestor.sessionEventCb = function (session, event) {
    requestor.log(event.toString());
    if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
        requestor.log('=== Successfully connected and ready to send requests. ===');
        requestor.request();
    } else if (event.sessionEventCode === solace.SessionEventCode.CONNECTING) {
        requestor.log('Connecting...');
    } else if (event.sessionEventCode === solace.SessionEventCode.DISCONNECTED) {
        requestor.log('Disconnected.');
        if (requestor.session !== null) {
            requestor.session.dispose();
            requestor.session = null;
        }
    }
};
```

The application logic can be triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```javascript
    if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
        requestor.log('=== Successfully connected and ready to send requests. ===');
        requestor.request();
        /*...SNIP...*/
    }
```

On the replier side we also might want to implement reaction to subscription error and to subscription added or removed:

```javascript
replier.sessionEventCb = function (session, event) {
    replier.log(event.toString());
    if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
        replier.log('=== Successfully connected and ready to subscribe to request topic. ===');
        replier.subscribe();
    } else if (event.sessionEventCode === solace.SessionEventCode.CONNECTING) {
        replier.log('Connecting...');
        replier.subscribed = false;
    } else if (event.sessionEventCode === solace.SessionEventCode.DISCONNECTED) {
        replier.log('Disconnected.');
        replier.subscribed = false;
        if (replier.session !== null) {
            replier.session.dispose();
            replier.session = null;
        }
    } else if (event.sessionEventCode === solace.SessionEventCode.SUBSCRIPTION_ERROR) {
        replier.log('Cannot subscribe to topic: ' + event.correlationKey);
    } else if (event.sessionEventCode === solace.SessionEventCode.SUBSCRIPTION_OK) {
        if (replier.subscribed) {
            replier.subscribed = false;
            replier.log('Successfully unsubscribed from request topic: ' + event.correlationKey);
        } else {
            replier.subscribed = true;
            replier.log('Successfully subscribed to request topic: ' + event.correlationKey);
            replier.log('=== Ready to receive requests. ===');
        }
    }
};
```

Notice how the replier application logic is also triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event:

```javascript
    if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
        replier.log('=== Successfully connected and ready to subscribe to request topic. ===');
        replier.subscribe();
        /*...SNIP...*/
    }
```

See the [Solace Systems Web Messaging API “Handling session events”]({{ site.docs-session-events }}){:target="_top"} documentation for the full list of session event codes.

## Making a request

First let’s look at the requestor. This is the application that will send the initial request message and wait for the reply.

![]({{ site.baseurl }}/images/Request-Reply_diagram-2.png)

The requestor must create a message and the topic to send the message to:

```javascript
var requestText = 'Sample Request';
var request = solace.SolclientFactory.createMessage();
request.setDestination(solace.SolclientFactory.createTopic(requestor.topicName));
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

## Replying to a request

Now it is time to receive the request and generate an appropriate reply.

![]({{ site.baseurl }}/images/Request-Reply_diagram-3.png)

Just as with previous tutorials, you still need to connect a session and subscribe to the topics that requests are sent on (the request topic). The following is an example of such reply.

```javascript
replier.reply = function (message) {
	if (replier.session !== null) {
		var reply = solace.SolclientFactory.createMessage();
		var replyText = message. message.getSdtContainer().getValue() + " - Sample Reply";
		reply.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, replyText));
		replier.session.sendReply(message, reply);
	} else {
		replier.log('Cannot reply: not connected to Solace message router.');
	}
};
```

The replier.reply is the function that is called from the replier message event callback that is passed to the `solace.SolclientFactory.createSession` call:

```javascript
replier.messageEventCb = function (session, message) {
	try {
		replier.reply(message);
	} catch (error) {
		replier.log(error.toString());
	}
};
```

## Receiving the Reply Message

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

Combining the example source code shown above results in the following source code files:

<ul>
{% for item in page.links %}
<li><a href="{{ site.repository }}{{ item.link }}" target="_blank">{{ item.label }}</a></li>
{% endfor %}
</ul>

### Running samples

The samples consist of two separate requestor and replier Node.js applications _(BasicRequestor.js_ and _BasicReplier.js)_.

Application is bootstrapped by calling the _run_ function with four application arguments that is expected to be the Solace message router IP address with its web connection port, the vpn name, the client username, and the client password.

In the requestor (_BasicRequestor.js_):

```javascript
var requestor = new BasicRequestor(solace, 'tutorial/topic');
var host = process.argv.slice(2)[0];
var vpnname = split[1];
var username = split[0];
var password = process.argv.slice(4)[0];
requestor.run(host, vpnname, username, password);
```

In the replier (_BasicReplier.js_):

```javascript
var BasicReplier = require('./BasicReplier');
var replier = new BasicReplier(solace, 'tutorial/topic');
var host = process.argv.slice(2)[0];
var vpnname = split[1];
var username = split[0];
var password = process.argv.slice(4)[0];
replier. replyOnSolace (host, vpnname, username, password);;
```

Both applications logic is triggered only after receiving the `solace.SessionEventCode.UP_NOTICE` event as demonstrated above.

The requestor application sends one request, receives a reply to it and exits, the replier application is running until Ctrl-C is pressed on the console.

**Sample Output**

First run _BasicReplier.js_ in Node.js, giving it arguments for the router’s connection properties (<host> <username>@<vpnname> <password>).

The following is a screenshot of the tutorial’s _BasicReplier.js_ application after it successfully connected to the Solace message router and subscribed to the request topic.

![]({{ site.baseurl }}/images/nodejs-reqrep-img-1.png)

Now, run _BasicRequestor.js_ in Node.js, also specifying the router’s connection properties.

It will connect to the router, send a request, receive a reply and exit.

The following is a screenshot of the tutorial’s _BasicRequestor.js_ application after it successfully connected to the Solace message router, sent a request, received a reply and exited.

![]({{ site.baseurl }}/images/nodejs-reqrep-img-2.png)

This is the replier replying to a request (_BasicReplier.js_):

![]({{ site.baseurl }}/images/nodejs-reqrep-img-3.png)

With that you now know how to successfully implement request-reply message exchange pattern using Direct messages.

If you have any issues sending and replying a message, check the [Solace community Q&A]({{ site.links-community }}){:target="_top"} for answers to common issues seen.
