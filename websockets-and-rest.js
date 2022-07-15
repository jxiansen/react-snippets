/*

Module: WebSocket
Author: Ashok Khanna
Last Update: 09-04-2022
License: MIT

Based on Bergi's Solution on Stack Overflow:
https://stackoverflow.com/questions/60512129/websocket-waiting-for-server-response-with-a-queue

How to use:

1. Import the module and create a socket instance:

```
import WebSocket from './Components/Websocket'

export const ws = new WebSocket("wss://www.url.com/socket-point");
```

2. Then simply use it in your functions as following (first import below
is to import the `ws' instance created above into the module where you are
using the socket:

```
import {ws} from './index'

...

function login() {
  ...
  ws.sendRequest(someMessageInJSONFormat,
      (value) => {
      ...<insert code to handle response here>>
      )}
}
```

Usually I like to create some sort of JSON object as in the above,
but if you read the below code then you can see there is a `sendMessage'
variant that can handle plain strings

 */

export default class WebSocket {
  constructor(url) {
    // 这里我们创建了一个空数组,一会会将其添加到数组中,注意我们也可以使用 {} 对象(数组也是对象)
    this.waitingResponse = [];

    // 我们创建了一个空数组作为消息的队列,存放因为 socket 被关闭而没有发送的消息队列,
    // 并在 onopen 处理程序中排队发送(这个程序将会遍历这个队列数组)
    this.messageQueue = [];

    this.url = url;

    // 我们将 socket 创建实例分离到自己的函数中, 因为我们需要在重新连接的尝试中调用它
    this.createSocket();
  }

  // 重新连接的逻辑是,每当消息发送失败,都会将发送的信息添加到消息队列并尝试重新连接
  // 因此当连接失败时,会在一定时间后重新连接,而是只有用户发起必须要有消息发送必须要和
  // socket 交互的时候才会重新连接
  createSocket() {
    this.socket = new WebSocket(this.url);

    // 遍历尚未发送的消息队列,如果该队列为空,则不发送消息

    // 所有队列中的消息都来自之前的 sendPayload事件,因此被解析成争取的JSON格式
    // 并在 waitingResponse 中拥有一个相关的请求对象
    this.socket.onopen = () => {
      this.messageQueue.forEach((item) => this.socket.send(item));
      this.messageQueue = [];
    };

    this.socket.onclose = () => console.log("ws closed");

    this.socket.onmessage = (e) => {
      this.processMessage(e);
    };
  }

  // 创建一个新的webSocket连接,并将任何未发送的数据添加到消息队列中
  recreateSocket(message) {
    console.log("Reconnection Attempted");
    this.messageQueue.push(message);
    this.createSocket();
  }

  // 关闭一个套接字，这可能需要一点时间（几秒钟），因为要在服务器上做一个往返的动作。
  // ，所以可能需要一点时间（几秒钟）。
  closeSocket() {
    this.socket.close();
    console.log("Socket closed manually.");
  }

  // 为用户提供一个启动新 socket 的函数,没有重新连接 socket 的方法,需要重新创建一个新的 webSocket
  openSocket() {
    this.createSocket();
    console.log("Socket opened manually.");
  }

  async sendPayload(details) {
    // Create a request where request = { sent: + new Date()} and this.waiting... = request
    // this means both request and waitingResponse[details.requestid] point to the same thing
    // so that changing request.test will also result in waitingResponse[details.requestid].test
    // having the same value

    // 注意这里的 detail.requestid是一个索引(事件戳),之后我们处理收到的消息的时候，将会检查收到消息的
    // requestid 的事件戳,对照这个 waitingResponse 数组,如果发现有匹配的就 resolve 出这个请求

    let requestid = +new Date();
    const request = (this.waitingResponse[requestid] = { sent: requestid });

    // Here we combine the request (which at this point is just { sent: ...} with the
    // actual data to be sent to form the final message to send
    const message = { ...request, ...details };

    // If Socket open then send the details (message) in String Format
    try {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      } else {
        // Otherwise we try to recreate the socket and send the message
        // after recreating the socket
        this.recreateSocket(JSON.stringify(message));
      }

      // Here we create a new promise function
      // We set the resolve property of request [which is also referenced
      // by waitingResponse[details.requestid] to the Promise's resolve function

      // Thus we can resolve the promise from processMessage (refer below)

      // We reject after 5 seconds of not receiving the associated message
      // with the same requestid
      const result = await new Promise(function (resolve, reject) {
        // This will automatically run, allowing us to access
        // the resolve function from outside this function
        request.resolve = resolve;

        console.log(request);
        // This will take 5 seconds to run, which becomes the lifecycle
        // of this Promise function - the resolve function must be
        // called before this point
        setTimeout(() => {
          reject("Timeout"); // or resolve({action: "to"}), or whatever
        }, 5000);
      });

      console.info("Time took", (+new Date() - request.sent) / 1000);

      // function returns result
      return result; // or {...request, ...result} if you care
    } finally {
      // code to run regardless of whether try worked or error thrown
      console.log("Exit code ran successfully");

      delete this.waitingResponse[requestid];
    }
  }

  // 异步消息接收器,我们把他附加到 onMessage 处理程序中,期待收到 JSON 格式的消息,否则抛出一个错误
  // 并简单的将消息纪录到控制台, 消息还必须又一个 “请求id” (requestid) 属性,再这里我们使用小写的 i
  // 因为Common Lisp的JZON库在JSON消息中小写属性名

  // 检查响应队列中的实体信息是否包含 requsetid 属性条目(data.requestid是数组的索引下标 sendPlayLoad
  // 这个函数在这个数组队列中为其变量id设置了一个值) 这个索引也有一个对该请求id的 promise resolve出对应值

  // 否则就会在控制台中打印出警告信息,这条数据并不会被处理从而解决掉,所以我们需要对每一条消息需要一个请求id 来捕获处理
  // 我们可以添加一个路由函数来专门处理服务器发送过的来的初始消息(在下面的第二个警告中)

  async processMessage(msg) {
    try {
      let data = JSON.parse(msg.data);

      if (data.hasOwnProperty("requestid")) {
        const request = this.waitingResponse[data.requestid];
        if (request) request.resolve(data);
        else
          console.warn(
            "Got data but found no associated request, already timed out?",
            data
          );
      } else {
        // Add handlers here for messages without request ID
        console.warn("Got data without request id", data);
      }
    } catch {
      console.log(msg.data);
    }
  }

  // 调用函数的主要入口，有一个简单的回调动作，对接收到的数据进行处理 这里的存在是为了减少调用函数的模板
  async sendRequest(
    details,
    resolution,
    rejection = (error) => {
      console.log(error);
    }
  ) {
    this.sendPayload(details).then(
      function (value) {
        resolution(value);
      },
      function (error) {
        rejection(error);
      }
    );
  }

  // 单向信息的第二个入口点，即不期望有任何回应。这绕过了上面的请求-响应承诺函数，
  // 首先尝试对对象进行JSON.stringify，如果不能变成JSON字符串，就直接发送对象。

  sendMessage(details) {
    // Example of an Immediately-Invoked Function Expression
    const message = (() => {
      try {
        return JSON.stringify(details);
      } catch (e) {
        return details;
      }
    })();

    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      // Otherwise we try to recreate the socket and send the message
      // after recreating the socket
      this.recreateSocket(message);
    }
  }
}
