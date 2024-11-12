import { createClient } from 'redis';
import { promisify } from 'util';

// Create Redis client
const client = createClient();

// Promisify the Redis commands we need
const rPush = promisify(client.rPush).bind(client);
const lPop = promisify(client.lPop).bind(client);
const publish = promisify(client.publish).bind(client);

// Connect to Redis
client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

await client.connect();
console.log('Redis client connected.');

// Enqueue a ticket request
async function enqueueTicketRequest(ticketRequest) {
  console.log(`Enqueueing ticket request for user ${ticketRequest.userId}...`);
  try {
    const result = await rPush('ticketQueue', JSON.stringify(ticketRequest));
    console.log(`Ticket request for user ${ticketRequest.userId} added to Redis queue.`);
    return result;
  } catch (err) {
    console.error('Error enqueuing ticket request:', err);
    throw err;
  }
}

// Dequeue a ticket request from Redis
async function dequeueTicketRequest() {
  console.log('Dequeueing ticket request from Redis...');
  try {
    const res = await lPop('ticketQueue');
    console.log(res)
    if (res) {
      console.log(`Dequeued ticket request: ${res}`);
      return JSON.parse(res); // Convert string back to JSON object
    } else {
      console.log('No ticket request found in Redis queue.');
      return null;
    }
  } catch (err) {
    console.error('Error dequeuing ticket request:', err);
    throw err;
  }
}

// Publish ticketBooked message to Redis channel
async function publishTicketBooked(ticket) {
  console.log(`Publishing ticketBooked message for ticketId: ${ticket.ticketId}`);
  try {
    const result = await publish('ticketBooked', JSON.stringify(ticket));
    console.log(`Published ticketBooked for ticketId: ${ticket.ticketId}`);
    return result;
  } catch (err) {
    console.error('Error publishing ticketBooked message:', err);
    throw err;
  }
}

export { enqueueTicketRequest, dequeueTicketRequest, publishTicketBooked };





