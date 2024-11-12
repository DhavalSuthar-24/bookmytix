

import express from 'express';
import { WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'url';
import QRCode from 'qrcode';
 

const app = express();
const port = 3000;


const redisClient = createClient();
const redisSubscriber = createClient();
const redisPublisher = createClient();

const userIdToWebSocket = new Map();




redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisSubscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
redisPublisher.on('error', (err) => console.error('Redis Publisher Error:', err));


await redisClient.connect();
await redisSubscriber.connect();
await redisPublisher.connect();
console.log('Redis clients connected.');


const wss = new WebSocketServer({ noServer: true });
let wsClients = [];

wss.on('connection', (ws, request) => {
  const params = new URLSearchParams(request.url.split('?')[1]);
  const userId = params.get('userId'); // Extract userId from query params

  if (!userId) {
    ws.close(1008, 'User ID is required');
    return;
  }

  console.log(`WebSocket client connected for userId: ${userId}`);
  userIdToWebSocket.set(userId, ws); // Map userId to this WebSocket

  ws.on('close', () => {
    console.log(`WebSocket client disconnected for userId: ${userId}`);
    userIdToWebSocket.delete(userId); // Remove mapping on disconnection
  });

  ws.on('error', (err) => {
    console.error(`Error for WebSocket client ${userId}:`, err);
    userIdToWebSocket.delete(userId); // Remove mapping on error
  });
});
// Notify all WebSocket clients about a new ticket
const notifyClient = (userId, ticket) => {
  const ws = userIdToWebSocket.get(userId); // Get WebSocket for userId
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(ticket));
    console.log(`Sent ticket to userId: ${userId}`);
  } else {
    console.warn(`WebSocket not available for userId: ${userId}`);
  }
};


// Subscribe to the "ticketBooked" Redis channel
const subscribeTicketBooked = async () => {
  await redisSubscriber.subscribe('ticketBooked', (message) => {
    const ticket = JSON.parse(message);
    console.log('Received ticketBooked message:', ticket);

    // Notify the specific client
    notifyClient(ticket.userId, ticket);
  });
  console.log('Subscribed to Redis "ticketBooked" channel.');
};


await subscribeTicketBooked();

// Express server setup
app.use(express.json());

// Route to request a ticket
app.post('/request-ticket', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    console.log(`Received ticket request for userId: ${userId}`);
    await enqueueTicketRequest({ userId });
    res.status(200).json({ message: 'Ticket request received. Please wait for confirmation.' });
  } catch (error) {
    console.error('Error processing ticket request:', error);
    res.status(500).json({ error: 'Failed to process ticket request' });
  }
});

// Enqueue ticket request to Redis queue
async function enqueueTicketRequest(ticketRequest) {
  console.log(`Enqueueing ticket request for user ${ticketRequest.userId}...`);
  try {
    await redisClient.rPush('ticketQueue', JSON.stringify(ticketRequest));
    console.log(`Ticket request for user ${ticketRequest.userId} added to Redis queue.`);
  } catch (error) {
    console.error('Error enqueuing ticket request:', error);
    throw error;
  }
}

// Dequeue a ticket request from Redis queue
async function dequeueTicketRequest() {
  console.log('Dequeueing ticket request from Redis...');
  try {
    const res = await redisClient.lPop('ticketQueue');
    if (res) {
      console.log(`Dequeued ticket request: ${res}`);
      return JSON.parse(res); // Convert string back to JSON object
    } else {
      console.log('No ticket request found in Redis queue.');
      return null;
    }
  } catch (error) {
    console.error('Error dequeuing ticket request:', error);
    throw error;
  }
}

// Function to simulate ticket processing and publishing
async function processTicketRequest() {
  console.log('Checking for new ticket requests...');
  const ticketRequest = await dequeueTicketRequest();

  if (ticketRequest) {
    console.log(`Processing ticket request for userId: ${ticketRequest.userId}`);
    
    // Simulate a booking delay of 2 seconds
    setTimeout(async () => {
      try {
        const ticketId = uuidv4();
        const qrCodeData = `TicketID:${ticketId},UserID:${ticketRequest.userId},Timestamp:${Date.now()}`;

        // Generate QR code
        const qrCodeImage = await QRCode.toDataURL(qrCodeData);

        const ticket = {
          ticketId,
          userId: ticketRequest.userId,
          qrCode: qrCodeImage, // Include the QR code image
          status: 'Booked',
          timestamp: Date.now(),
        };

        await publishTicketBooked(ticket);
        console.log(`Ticket booked: ${ticket.ticketId}`);
      } catch (error) {
        console.error('Error during ticket booking process:', error);
      }
    }, 2000); // Simulate a booking delay
  } else {
    console.log('No ticket request found.');
  }
}


// Publish ticketBooked message to Redis channel
async function publishTicketBooked(ticket) {
  console.log(`Publishing ticketBooked message for ticketId: ${ticket.ticketId}`);
  try {
    await redisPublisher.publish('ticketBooked', JSON.stringify(ticket));
    console.log(`Published ticketBooked for ticketId: ${ticket.ticketId}`);
  } catch (error) {
    console.error('Error publishing ticketBooked message:', error);
    throw error;
  }
}

// Start a process to periodically check and process ticket requests from Redis queue
setInterval(processTicketRequest, 5000); // Check for new tickets every 5 seconds

// Start the Express server
app.server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Handle WebSocket upgrades
app.server.on('upgrade', (request, socket, head) => {
  const parsedUrl = parse(request.url, true); // Parse URL to get query params
  const userId = parsedUrl.query.userId; // Extract userId from query params

  if (!userId) {
    socket.destroy();
    console.error('User ID is required for WebSocket connection.');
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.userId = userId; // Attach userId to WebSocket instance
    wss.emit('connection', ws, request);
  });
});