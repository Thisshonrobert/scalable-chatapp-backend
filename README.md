# WebSocket Chat Application with Redis Pub/Sub

This project is a backend for a real-time group chat application. It uses WebSockets for persistent client-server communication and Redis Pub/Sub to enable a scalable, multi-instance architecture.

## Features

- **Real-time Messaging**: Instant message delivery using WebSockets.
- **Group Chat**: Users can subscribe to and send messages within multiple groups.
- **Scalable Architecture**: Leverages Redis Pub/Sub to broadcast messages, allowing the backend to be scaled horizontally across multiple server instances.
- **Dynamic Subscriptions**: Users can join and leave groups on-the-fly.
- **Connection Management**: Handles user connections, disconnections, and cleans up subscriptions gracefully.

## Architecture

The application is built around a few key components:

1.  **WebSocket Server**: Built with the `ws` library, it manages individual client connections. Each connected user is assigned a unique ID.
2.  **In-Memory State**: Each server instance maintains two in-memory objects:
    - `Users`: Maps a user's ID to their WebSocket connection and the list of groups they are subscribed to.
    - `reverseUsers`: Maps a group ID to the list of users on that instance who are subscribed to it. This is used for efficient message broadcasting to local clients.
3.  **Redis Pub/Sub**: Redis acts as a message bus.
    - **Publisher Client**: When a user sends a message to a group, the server publishes that message to a Redis channel named after the group ID.
    - **Subscriber Client**: Each server instance subscribes to Redis channels for groups that have at least one active user on that instance. When a message is received from a Redis channel, the server broadcasts it to all relevant WebSocket clients connected to it.

This design ensures that a message sent from a user connected to one server instance is correctly relayed to all users in the same group, even if they are connected to different server instances.

### How it Works

1.  A client connects to the WebSocket server and is assigned a `UserId`.
2.  The client sends a `SUBSCRIBE` message to join a group (e.g., `{ "type": "SUBSCRIBE", "groupId": 1001 }`).
3.  The server updates its in-memory state. If this is the first user on this instance to join this group, the server's `subscriberClient` subscribes to the corresponding Redis channel (e.g., `1001`).
4.  To send a message, the client sends a `MESSAGE` payload (e.g., `{ "type": "MESSAGE", "groupId": 1001, "message": "Hello everyone!" }`).
5.  The server's `publisherClient` publishes this message to the `1001` Redis channel.
6.  All server instances subscribed to the `1001` channel (including the originating one) receive the message.
7.  Each receiving server looks up the list of local users subscribed to group `1001` and forwards the message to them via their WebSocket connections.
8.  When a user disconnects or sends an `UNSUBSCRIBE` message, the server cleans up its state. If a group has no more subscribers on an instance, the server unsubscribes from the corresponding Redis channel to save resources.

## Prerequisites

- Node.js (v16 or later recommended)
- Redis server running

## Getting Started

1.  **Clone the repository and navigate to the project directory:**

    ```bash
    git clone <repository-url>
    cd chatapp
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Compile TypeScript:**

    ```bash
    npx tsc
    ```

4.  **Run the server:**

    ```bash
    node index.js
    ```

The WebSocket server will start on `ws://localhost:8080`.

## API

Clients communicate with the server by sending JSON messages over the WebSocket connection.

### Message Format

```json
{
  "type": "SUBSCRIBE" | "UNSUBSCRIBE" | "MESSAGE",
  "groupId": number,
  "message"?: string
}
```

- **`SUBSCRIBE`**: Subscribes the user to the specified `groupId`.
- **`UNSUBSCRIBE`**: Unsubscribes the user from the specified `groupId`.
- **`MESSAGE`**: Sends the `message` content to all users in the specified `groupId`.