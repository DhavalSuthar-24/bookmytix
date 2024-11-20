import jwt from "jsonwebtoken";
import { prisma } from "../index.js"; // Ensure Prisma client is initialized


export const errorHandler =(statusCode,message)=>{
    const error = new Error(message);
    error.statusCode = statusCode;
    return error
}

export const verifyAuth = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      console.log(token,"ttttttttttt")
  
      if (!token) {
        return next(errorHandler(401, "Unauthorized. Token is missing."));
      }
  
      // Decode the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(decoded,"dddddddddddddddddd")
  
      if (!decoded || !decoded.userId) {
        return next(errorHandler(401, "Unauthorized. Invalid token."));
      }
  
      // Attach user information to the request
      req.user = { id: decoded.userId };
      next();
    } catch (error) {
      console.error("Error in verifyAuth middleware:", error);
      return next(errorHandler(500, "Internal server error during authentication."));
    }
  };
  
  // Middleware to check if the user is an organizer
  export const verifyOrganizer = async (req, res, next) => {
    try {
      const organizer = await prisma.organizer.findUnique({ where: { id: req.user.id } });
      if (!organizer) {
        return next(errorHandler(403, "Access denied. Organizer only route."));
      }
  
      req.user.role = "organizer";
      req.user.name = organizer.name;
      next();
    } catch (error) {
      console.error("Error in verifyOrganizer middleware:", error);
      return next(errorHandler(500, "Internal server error during role verification."));
    }
  };
  
  // Middleware to check if the user is a standard user
  export const verifyUser = async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        return next(errorHandler(403, "Access denied. User only route."));
      }
  
      req.user.role = "user";
      req.user.name = user.name;
      next();
    } catch (error) {
      console.error("Error in verifyUser middleware:", error);
      return next(errorHandler(500, "Internal server error during role verification."));
    }
  };