# Solace Node.js API advanced samples

This directory contains code showing how to make use of advanced features of the Solace message-router.

To learn more about the features, refer to the [Solace developer guide]( https://docs.solace.com/Solace-Messaging-APIs/Developer-Guide/Developer-Guide-Home.htm)

The code requires Node.js API version 10 or later.

* ActiveFlowIndication: This sample will show how multiple flows can bind to an exclusive queue, but only one client at a time can actively receive messages. If the Active Flow Indication Flow property is enabled, a Flow active/inactive event is returned to the client when its bound flow becomes/stops being the active flow. Start this app, then the `basic-samples/ConfirmedPublish` app can be used to send 10 messages to trigger it.

    Pre-requisite: this sample requires that the queue "tutorial/queue" exists on the message-router and configured to be "exclusive". 

* DTEConsumer: This sample shows how to consume messages from a Durable Topic Endpoint (DTE). The sample will associate the DTE with the topic "tutorial/topic", so the `basic-samples/TopicPublisher` app can be used to send messages to this topic.

    Pre-requisite: the DTE with the name "tutorial/dte" must have been provisioned on the message-router vpn. 

* EventMonitor: This sample demonstrates how to use the special event monitoring topic subscriptions to build an application that monitors message-router generated events. Start this sample then run any other sample app and observe a client connect event reported for that sample.

    Pre-requisite: configure the vpn on the message-router to "Publish Client Event Messages".

* GuaranteedRequestor/Replier: This sample will show the implementation of guaranteed Request-Reply messaging, where `GuaranteedRequestor` is a message Endpoint that sends a guaranteed request message to a request topic and waits to receive a reply message on a dedicated temporary queue as a response; `GuaranteedReplier` is a message Endpoint that waits to receive a request message on a request topic - it will create a non-durable topic endpoint for that - and responds to it by sending a guaranteed reply message. Start the replier first as the non-durable topic endpoint will only be created for the duration of the replier session and any request sent before that will not be received.

* NoLocalPubSub: This sample will show the use of the NO_LOCAL Session and Flow properties. With these properties enabled, messages published on a Session cannot be received on that same session or on a Flow on that Session even when there is a matching subscription. This sample will create and use a temporary queue.

* SecureSession: This sample will show the use of secure connection to the server using server and client certificate authentication.

    Pre-requisites:
    
       Following certificates and key must be locally available in the `certs` folder under `advanced-samples`:
           * root_ca-rsa.crt - root certificate of the Certificate Authority which signed the message-router's certificate
           * client1-rsa-1.crt - client certificate
           * client1-rsa-1.key - client private key
       
       On the message router:
           * server trusted root is configured
           * server-certificate is configured
           
