import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";

const wss = new WebSocketServer({ port: 8080 });

const publisherClient = createClient();
const subscriberClient = createClient();
publisherClient.connect();
subscriberClient.connect();

interface Message {
  type: "SUBSCRIBE" | "MESSAGE" | "UNSUBSCRIBE";
  groupId: number;
  message?: string
}

const Users: {
  [key: string]:
  {
    ws: WebSocket;
    groupIds: number[];
  }
} = {

  // "UserId1":{
  //   ws,
  //   groupIds :[1001, 1002]
  // },

  // "2":{
  //   ws,
  //   groupIds :[1001]
  // }

};


const reverseUsers: {
  [key: string]: {
    userIds: number[];
  }
} = {

  // "GroupId1001":{
  //   userIds:[1]
  // },
  // "1002":{
  //   userIds:[1,2]
  // }

};

let id = 0;

wss.on('connection', function connection(userSocket) {
  userSocket.on('error', console.error);
  userSocket.send('you are connected to the server');

  const UserId = id++;
  Users[UserId] = {
    ws: userSocket,
    groupIds: []
  }

  console.log(Users);
  console.log(`User connected with id ${UserId}`);

  userSocket.on('message', function message(raw: Message) {
    const data: Message = JSON.parse(raw.toString());
    if (data.type === 'SUBSCRIBE') {

      if (!Users[UserId]!.groupIds.includes(data.groupId)) {
        Users[UserId]!.groupIds.push(data.groupId);
      }
      const groupIdstr = data.groupId.toString();
      
      if (!reverseUsers[groupIdstr]!.userIds.includes(UserId)) {
        reverseUsers[groupIdstr]!.userIds.push(UserId);
      }
      // IF THIS IS THE FIRST USER TO SUBSCRIBE TO THIS GROUP, WE NEED TO SUBSCRIBE TO THE REDIS CHANNEL

      if (!reverseUsers[groupIdstr]) {

        //initialize reverseUsers
        reverseUsers[groupIdstr] = {
          userIds: []
        };

        subscriberClient.subscribe(groupIdstr, (msg) => {
          try {
            const { type, groupId, message: msgContent } = JSON.parse(msg);
            if (type === "MESSAGE") {
              console.log(`[Redis] Received message for group ${groupId}: ${msgContent}`);

              // Send to all users in this specific group
              reverseUsers[groupIdstr]?.userIds.forEach(userId => {

                //checks whether the user is present in Users and that specific user is subed to that grp
                if (Users[userId] && Users[userId].groupIds.includes(groupId)) {
                  Users[userId].ws.send(msgContent);
                }
              });
            }
          } catch (error) {
            console.error('Error processing Redis message:', error);
          }
        });

        console.log(`Subscribed to Redis channel: ${groupIdstr}`);
      }


    }
    console.log(Users);


    if (data.type === 'UNSUBSCRIBE') {
      Users[UserId]!.groupIds = Users[UserId]!.groupIds.filter((id) => id !== data.groupId);

      const groupIdstr = data.groupId.toString();
      if (reverseUsers[groupIdstr]) {
        reverseUsers[groupIdstr]!.userIds = reverseUsers[groupIdstr].userIds.filter((id) => id !== UserId)

        if (reverseUsers[groupIdstr].userIds.length === 0) {
          subscriberClient.unsubscribe(groupIdstr);
          delete reverseUsers[groupIdstr];
        }
      }


    }
    if (data.type === 'MESSAGE') {

      publisherClient.publish(data.groupId.toString(), JSON.stringify({
        type: "MESSAGE",
        groupId: data.groupId,
        message: data.message!
      }));
    }
  });
  userSocket.on('close', () => {
    // Clean up when user disconnects
    if (Users[UserId]) {
      // Unsubscribe from all groups
      Users[UserId].groupIds.forEach(groupId => {
        const groupIdStr = groupId.toString();
        if (reverseUsers[groupIdStr]) {
          reverseUsers[groupIdStr].userIds = reverseUsers[groupIdStr].userIds.filter(id => id !== UserId);
          if (reverseUsers[groupIdStr].userIds.length === 0) {
            subscriberClient.unsubscribe(groupIdStr);
            delete reverseUsers[groupIdStr];
            console.log(`Unsubscribed from Redis channel: ${groupIdStr} (user disconnected)`);
          }
        }
      });

      delete Users[UserId];
      console.log(`User ${UserId} disconnected`);
    }
  });

});