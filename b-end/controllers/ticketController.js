// import { enqueueTicketRequest } from "../services/ticketProcessor.js";




// import { prisma } from "../index.js";
// import { errorHandler } from "../utils/middlewares.js";

// // Book a Ticket
// export const ticketBook = async (req, res, next) => {
//   const { eventId, ticketTypeId } = req.body;

//   try {
//     const { id: userId } = req.user; // User must be logged in and authenticated

//     // Check if the event exists
//     const event = await prisma.event.findUnique({
//       where: { id: eventId },
//     });
//     if (!event) {
//       return next(errorHandler(404, "Event not found"));
//     }

//     // Check if the ticket type exists
//     const ticketType = await prisma.ticketType.findUnique({
//       where: { id: ticketTypeId },
//     });
//     if (!ticketType) {
//       return next(errorHandler(404, "Ticket type not found"));
//     }

//     // Enqueue the ticket booking request to Redis
//     await enqueueTicketRequest({
//       userId,
//       eventId,
//       ticketTypeId,
//     });

//     // Respond with a success message while the actual ticket is being processed
//     res.status(200).json({ message: "Ticket booking request received. Please wait for confirmation." });
//   } catch (error) {
//     console.error("Error booking ticket:", error);
//     next(errorHandler(500, "Error booking ticket"));
//   }
// };

// // Scan a Ticket (for Organizers)
// export const scanTicket = async (req, res, next) => {
//   const { qrCode } = req.body;

//   try {
//     const ticket = await prisma.ticket.findUnique({
//       where: { qrCode },
//       include: { event: true },
//     });

//     if (!ticket) {
//       return next(errorHandler(404, "Ticket not found"));
//     }

//     // Check if the ticket is already used
//     if (ticket.isUsed) {
//       return res.status(400).json({ message: "Ticket has already been used" });
//     }

//     // Mark the ticket as used
//     await prisma.ticket.update({
//       where: { qrCode },
//       data: { isUsed: true },
//     });

//     res.status(200).json({ message: "Ticket scanned successfully", ticket });
//   } catch (error) {
//     console.error("Error scanning ticket:", error);
//     next(errorHandler(500, "Error scanning ticket"));
//   }
// };


// export const cancelTicket = async (req, res, next) => {
//   const { id } = req.params;

//   try {
//     const { id: userId } = req.user; // User must be logged in and authenticated

//     // Find the ticket and ensure it belongs to the user
//     const ticket = await prisma.ticket.findUnique({
//       where: { id },
//     });

//     if (!ticket || ticket.userId !== userId) {
//       return next(errorHandler(404, "Ticket not found or not owned by the user"));
//     }

//     // Delete the ticket
//     await prisma.ticket.delete({
//       where: { id },
//     });

//     res.status(200).json({ message: "Ticket canceled successfully" });
//   } catch (error) {
//     console.error("Error canceling ticket:", error);
//     next(errorHandler(500, "Error canceling ticket"));
//   }
// };

// // Get Ticket Details
// export const getTicketDetails = async (req, res, next) => {
//   const { id } = req.params;

//   try {
//     const ticket = await prisma.ticket.findUnique({
//       where: { id },
//       include: {
//         event: true,
//         ticketType: true,
//         user: true,
//       },
//     });

//     if (!ticket) {
//       return next(errorHandler(404, "Ticket not found"));
//     }

//     res.status(200).json(ticket);
//   } catch (error) {
//     console.error("Error fetching ticket details:", error);
//     next(errorHandler(500, "Error fetching ticket details"));
//   }
// };

// // Get All Tickets for a User
// export const getUserTickets = async (req, res, next) => {
//   try {
//     const { id: userId } = req.user; // User must be logged in and authenticated

//     const tickets = await prisma.ticket.findMany({
//       where: { userId },
//       include: {
//         event: true,
//         ticketType: true,
//       },
//     });

//     res.status(200).json(tickets);
//   } catch (error) {
//     console.error("Error fetching user tickets:", error);
//     next(errorHandler(500, "Error fetching user tickets"));
//   }
// };








import { enqueueTicketRequest,startProcessing } from "../services/ticketProcessor.js";
import { prisma } from "../index.js";
import { errorHandler } from "../utils/middlewares.js";

// Book a Ticket
export const ticketBook = async (req, res, next) => {
  const { eventId, ticketTypeId } = req.body;

  try {
    const { id: userId } = req.user; // User must be logged in and authenticated

    // Check if the event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      return next(errorHandler(404, "Event not found"));
    }

    // Check if the ticket type exists
    const ticketType = await prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
    });
    if (!ticketType) {
      return next(errorHandler(404, "Ticket type not found"));
    }

    // Check if there is available capacity for the selected ticket type
    const ticketsSold = await prisma.ticket.count({
      where: { eventId, ticketTypeId, isUsed: false },
    });

    const remainingCapacity = event.totalCapacity - ticketsSold;

    if (remainingCapacity <= 0) {
      return next(errorHandler(400, "No available tickets for this event"));
    }

    if (!processingStarted) {
      processingStarted = true;
      startProcessing(); // Start the ticket processing loop
    }

    // Enqueue the ticket booking request to Redis
    await enqueueTicketRequest({
      userId,
      eventId,
      ticketTypeId,
    });


    res.status(200).json({ message: "Ticket booking request received. Please wait for confirmation." });
  } catch (error) {
    console.error("Error booking ticket:", error);
    next(errorHandler(500, "Error booking ticket"));
  }
};

export const scanTicket = async (req, res, next) => {
  const { qrCode } = req.body;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { qrCode },
      include: { event: true, ticketType: true },
    });

    if (!ticket) {
      return next(errorHandler(404, "Ticket not found"));
    }

    if (ticket.isUsed) {
      return res.status(400).json({ message: "Ticket has already been used" });
    }


    await prisma.ticket.update({
      where: { qrCode },
      data: { isUsed: true },
    });

    res.status(200).json({ message: "Ticket scanned successfully", ticket });
  } catch (error) {
    console.error("Error scanning ticket:", error);
    next(errorHandler(500, "Error scanning ticket"));
  }
};


export const cancelTicket = async (req, res, next) => {
  const { id } = req.params;

  try {
    const { id: userId } = req.user; // User must be logged in and authenticated

    // Find the ticket and ensure it belongs to the user
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket || ticket.userId !== userId) {
      return next(errorHandler(404, "Ticket not found or not owned by the user"));
    }

    // Ensure the ticket is not already used
    if (ticket.isUsed) {
      return next(errorHandler(400, "Ticket has already been used and cannot be canceled"));
    }

    // Delete the ticket
    await prisma.ticket.delete({
      where: { id },
    });

    res.status(200).json({ message: "Ticket canceled successfully" });
  } catch (error) {
    console.error("Error canceling ticket:", error);
    next(errorHandler(500, "Error canceling ticket"));
  }
};

// Get Ticket Details
export const getTicketDetails = async (req, res, next) => {
  const { id } = req.params;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: true,
        ticketType: true,
        user: true,
      },
    });

    if (!ticket) {
      return next(errorHandler(404, "Ticket not found"));
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error("Error fetching ticket details:", error);
    next(errorHandler(500, "Error fetching ticket details"));
  }
};

// Get All Tickets for a User
export const getUserTickets = async (req, res, next) => {
  try {
    const { id: userId } = req.user; // User must be logged in and authenticated

    const tickets = await prisma.ticket.findMany({
      where: { userId },
      include: {
        event: true,
        ticketType: true,
      },
    });

    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    next(errorHandler(500, "Error fetching user tickets"));
  }
};
