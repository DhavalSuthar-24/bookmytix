// import QRCode from 'qrcode';
// import fs from 'fs/promises';
// import path from 'path';
// import { redisClient, redisPublisher } from './redisClient.js';
// import { prisma } from '../index.js'; // Prisma client import
// import { notifyClient } from './websocket.js';

// // Directory for storing QR codes
// const qrCodeDirectory = path.resolve('qr-codes');

// // Enqueue ticket request
// export async function enqueueTicketRequest(ticketRequest) {
//   try {
//     console.log(`[ENQUEUE] Adding ticket request for user ${ticketRequest.userId} to the queue...`);
//     await redisClient.rPush('ticketQueue', JSON.stringify(ticketRequest));
//     console.log(`[ENQUEUE] Successfully enqueued ticket request for user ${ticketRequest.userId}.`);
//   } catch (error) {
//     console.error('[ENQUEUE ERROR] Error enqueueing ticket request:', error);
//   }
// }

// // Dequeue ticket request
// export async function dequeueTicketRequest() {
//   try {
//     console.log('[DEQUEUE] Attempting to dequeue ticket request...');
//     const res = await redisClient.lPop('ticketQueue');
//     if (res) {
//       console.log('[DEQUEUE] Successfully dequeued ticket request.');
//       return JSON.parse(res);
//     } else {
//       console.log('[DEQUEUE] No ticket requests found in the queue.');
//       return null;
//     }
//   } catch (error) {
//     console.error('[DEQUEUE ERROR] Error dequeuing ticket request:', error);
//     return null;
//   }
// }

// // Process ticket request
// export async function processTicketRequest() {
//   const ticketRequest = await dequeueTicketRequest();

//   if (ticketRequest) {
//     console.log(`[PROCESS] Processing ticket request for userId: ${ticketRequest.userId}`);
//     console.log(`[PROCESS] Ticket Request Details:`, ticketRequest);

//     try {
//       // Check if the event exists
//       const event = await prisma.event.findUnique({
//         where: { id: ticketRequest.eventId },
//       });
//       if (!event) {
//         console.error(`[ERROR] Event with ID ${ticketRequest.eventId} not found.`);
//         return;
//       }
//       console.log(`[PROCESS] Event found: ${event.name}, Total Capacity: ${event.totalCapacity}`);

//       // Check if the ticket type exists
//       const ticketType = await prisma.ticketType.findUnique({
//         where: { id: ticketRequest.ticketTypeId },
//       });
//       if (!ticketType) {
//         console.error(`[ERROR] Ticket Type with ID ${ticketRequest.ticketTypeId} not found.`);
//         return;
//       }
//       console.log(`[PROCESS] Ticket Type found: ${ticketType.name}`);

//       // Check the remaining capacity before booking
//       const ticketsSold = await prisma.ticket.count({
//         where: {
//           eventId: ticketRequest.eventId,
//           ticketTypeId: ticketRequest.ticketTypeId,
//           isUsed: false,
//         },
//       });
//       const remainingCapacity = event.totalCapacity - ticketsSold;
//       console.log(`[PROCESS] Tickets Sold: ${ticketsSold}, Remaining Capacity: ${remainingCapacity}`);

//       if (remainingCapacity <= 0) {
//         console.error(`[ERROR] No remaining capacity for Event ID ${ticketRequest.eventId}, Ticket Type ID ${ticketRequest.ticketTypeId}`);
//         return;
//       }

//       // Generate QR code and save as a file
//       console.log('[PROCESS] Generating QR code...');
//       const qrCodeData = `UserID:${ticketRequest.userId},EventID:${ticketRequest.eventId},TicketTypeID:${ticketRequest.ticketTypeId}`;
//       const fileName = `${ticketRequest.userId}-${Date.now()}.png`;
//       const filePath = path.join(qrCodeDirectory, fileName);

//       // Ensure the directory exists
//       await fs.mkdir(qrCodeDirectory, { recursive: true });

//       // Save QR code as a file
//       await QRCode.toFile(filePath, qrCodeData);
//       const qrCodeUrl = `/qr-codes/${fileName}`; // Use a relative or static URL
//       console.log('[PROCESS] QR code generated and saved successfully.');

//       // Create the ticket in the database
//       console.log('[PROCESS] Creating ticket in the database...');
//       const ticket = await prisma.ticket.create({
//         data: {
//           qrCode: qrCodeUrl, // Save the URL
//           userId: ticketRequest.userId,
//           eventId: ticketRequest.eventId,
//           ticketTypeId: ticketRequest.ticketTypeId,
//           isUsed: false,
//         },
//       });
//       console.log('[PROCESS] Ticket created successfully:', ticket);

//       // Publish ticketBooked event to Redis
//       await publishTicketBooked(ticket);
//     } catch (error) {
//       console.error("[PROCESS ERROR] Error processing ticket request:", error);
//     }
//   }
// }

// // Publish ticketBooked event to Redis
// async function publishTicketBooked(ticket) {
//   try {
//     console.log(`[PUBLISH] Publishing ticketBooked event for userId: ${ticket.userId}`);
//     await redisPublisher.publish('ticketBooked', JSON.stringify(ticket));
//     console.log('[PUBLISH] Event published successfully.');

//     // Notify the client via WebSocket
//     notifyClient(ticket.userId, ticket);
//     console.log(`[PUBLISH] WebSocket notification sent to userId: ${ticket.userId}`);
//   } catch (error) {
//     console.error('[PUBLISH ERROR] Error publishing ticketBooked event:', error);
//   }
// }

// // Start processing ticket requests at regular intervals
// const interval = 5000; // Poll every 5 seconds for ticket requests
// async function startProcessing() {
//   console.log('[START] Starting the ticket processing loop...');
//   try {
//     await processTicketRequest();
//   } catch (error) {
//     console.error('[PROCESS LOOP ERROR] Error in processing loop:', error);
//   }
//   setTimeout(startProcessing, interval); // Use setTimeout instead of setInterval for better async handling
// }

// startProcessing(); // Start the ticket request processing loop



import QRCode from 'qrcode';
import fs from 'fs/promises';
import path from 'path';
import { redisClient, redisPublisher } from './redisClient.js';
import { prisma } from '../index.js'; // Prisma client import
import { notifyClient } from './websocket.js';

// Directory for storing QR codes
const qrCodeDirectory = path.resolve('qr-codes');

// Enqueue ticket request
export async function enqueueTicketRequest(ticketRequest) {
  try {
    console.log(`[ENQUEUE] Adding ticket request for user ${ticketRequest.userId} to the queue...`);
    await redisClient.rPush('ticketQueue', JSON.stringify(ticketRequest));
    console.log(`[ENQUEUE] Successfully enqueued ticket request for user ${ticketRequest.userId}.`);
  } catch (error) {
    console.error('[ENQUEUE ERROR] Error enqueueing ticket request:', error);
  }
}

// Dequeue ticket request
export async function dequeueTicketRequest() {
  try {
    console.log('[DEQUEUE] Attempting to dequeue ticket request...');
    const res = await redisClient.lPop('ticketQueue');
    if (res) {
      console.log('[DEQUEUE] Successfully dequeued ticket request.');
      return JSON.parse(res);
    } else {
      console.log('[DEQUEUE] No ticket requests found in the queue.');
      return null;
    }
  } catch (error) {
    console.error('[DEQUEUE ERROR] Error dequeuing ticket request:', error);
    return null;
  }
}

// Process ticket request
export async function processTicketRequest() {
  const ticketRequest = await dequeueTicketRequest();

  if (ticketRequest) {
    console.log(`[PROCESS] Processing ticket request for userId: ${ticketRequest.userId}`);
    console.log(`[PROCESS] Ticket Request Details:`, ticketRequest);

    try {
      const event = await prisma.event.findUnique({
        where: { id: ticketRequest.eventId },
      });
      if (!event) {
        console.error(`[ERROR] Event with ID ${ticketRequest.eventId} not found.`);
        return;
      }

      const ticketType = await prisma.ticketType.findUnique({
        where: { id: ticketRequest.ticketTypeId },
      });
      if (!ticketType) {
        console.error(`[ERROR] Ticket Type with ID ${ticketRequest.ticketTypeId} not found.`);
        return;
      }

      const ticketsSold = await prisma.ticket.count({
        where: {
          eventId: ticketRequest.eventId,
          ticketTypeId: ticketRequest.ticketTypeId,
          isUsed: false,
        },
      });
      const remainingCapacity = event.totalCapacity - ticketsSold;

      if (remainingCapacity <= 0) {
        console.error(`[ERROR] No remaining capacity for Event ID ${ticketRequest.eventId}`);
        return;
      }

      const qrCodeData = `UserID:${ticketRequest.userId},EventID:${ticketRequest.eventId},TicketTypeID:${ticketRequest.ticketTypeId}`;
      const fileName = `${ticketRequest.userId}-${Date.now()}.png`;
      const filePath = path.join(qrCodeDirectory, fileName);

      await fs.mkdir(qrCodeDirectory, { recursive: true });
      await QRCode.toFile(filePath, qrCodeData);
      const qrCodeUrl = `/qr-codes/${fileName}`;

      const ticket = await prisma.ticket.create({
        data: {
          qrCode: qrCodeUrl,
          userId: ticketRequest.userId,
          eventId: ticketRequest.eventId,
          ticketTypeId: ticketRequest.ticketTypeId,
          isUsed: false,
        },
      });

      await publishTicketBooked(ticket);
    } catch (error) {
      console.error("[PROCESS ERROR] Error processing ticket request:", error);
    }
  }
}

// Publish ticketBooked event
async function publishTicketBooked(ticket) {
  try {
    console.log(`[PUBLISH] Publishing ticketBooked event for userId: ${ticket.userId}`);
    await redisPublisher.publish('ticketBooked', JSON.stringify(ticket));
    notifyClient(ticket.userId, ticket);
  } catch (error) {
    console.error('[PUBLISH ERROR] Error publishing ticketBooked event:', error);
  }
}

// Export a startProcessing function
export async function startProcessing() {
  console.log('[START] Starting the ticket processing loop...');
  try {
    await processTicketRequest();
    setTimeout(startProcessing, 5000); // Recursive call for loop
  } catch (error) {
    console.error('[PROCESS LOOP ERROR] Error in processing loop:', error);
  }
}
