// In ticketProcessing.js
async function processTicketRequest() {
    console.log("Checking for new ticket request...");

    const ticketRequest = await dequeueTicketRequest();

    if (ticketRequest) {
        console.log(`Processing ticket for user ${ticketRequest.userId}`);

        // Simulate ticket booking process (2-second delay)
        setTimeout(async () => {
            try {
                // Generate a unique ticket ID
                const ticketId = crypto.randomUUID();
                console.log(`Generated ticket ID: ${ticketId}`);

                // Generate a QR code
                const qrCode = await qrcode.toDataURL(ticketId);
                console.log(`Generated QR code for ticket ${ticketId}`);

                const ticket = {
                    ticketId,
                    userId: ticketRequest.userId,
                    qrCode,
                    status: "Booked",
                    timestamp: Date.now(),
                };

                // Publish the ticket to Redis
                await publishTicketBooked(ticket);

                console.log(`Ticket booked for user ${ticketRequest.userId} with ticketId: ${ticketId}`);
            } catch (error) {
                console.error("Error processing ticket request:", error);
            }
        }, 2000); // Simulate a 2-second booking delay
    } else {
        console.log("No ticket requests in the queue.");
    }
}

// Continuously process tickets from the queue
setInterval(processTicketRequest, 5000);
