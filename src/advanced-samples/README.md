ADVANCED SAMPLES list and instructions.

* ClientAck: This sample shows how to explicitly send an acknowledgment from the client for each persistent message received and processed, vs. using the default auto acknowledgement. Use the `basic-samples/QueueProducer` app to send messages to the queue "tutorial/queue".

* DTEConsumer: This sample shows how to consume messages from a Durable Topic Endpoint (DTE). The DTE with the name "tutorial/DTE" must have been provisioned on the message router vpn. The sample will associate the DTE with the topic "tutorial/topic", so the `basic-samples/TopicPublisher` app can be used to send messages to this topic.

* ActiveFlowIndication: This sample will show how multiple flows can bind to an exclusive queue, but only one client at a time can actively receive messages. If the Active Flow Indication Flow property is enabled, a Flow active/inactive event is returned to the client when its bound flow becomes/stops being the active flow. This sample requires that the queue "tutorial/queue" exists and configured to be "exclusive". Start this app, then the `basic-samples/ConfirmedPublish` app can be used to send 10 messages to trigger it.

* NoLocalPubSub: This sample will show the use of the NO_LOCAL Session and Flow properties. With these properties enabled, messages published on a Session cannot be received on that same session or on a Flow on that Session even when there is a matching subscription. This sample will create and use a temporary queue so no provisioning on the message-router is required.

* Guaranteed Requestor/Replier: This sample will show the implementation for guaranteed Request-Reply messaging, where `GuaranteedRequestor` is a message Endpoint that sends a guaranteed request message and waits to receive a reply message on a dedicated temporary queue as a response; `GuaranteedReplier` is a message Endpoint that waits to receive a request message on a request queue and responds to it by sending a guaranteed reply message. This sample requires that the queue "tutorial/requestqueue" exists.

* Event Monitor: This sample demonstrates how to use the special event monitoring topic subscriptions to build an application that monitors message-router generated events. Start this sample then run any other sample and observe a client connect event reported for that sample.

* SecureServer: This sample will show the use of secure connection to the server using client certificate authentication. Prerequisites on the message router: server trusted root is configured as certs/root_ca-rsa.crt, server-certificate is configured as certs/server1-rsa.pem. 















:

