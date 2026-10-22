import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes";
import vehicleRoutes from "./routes/vehicles.routes";
import customerRoutes from "./routes/customers.routes";
import saleRoutes from "./routes/sales.routes";
import employeeRoutes from "./routes/employees.routes";
import expenseRoutes from "./routes/expenses.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import membershipRoutes from "./routes/membership.routes";
import inventoryRoutes from "./routes/inventory.routes";
import hrRoutes from "./routes/hr.routes";
import ticketRoutes from "./routes/tickets.routes";
import notificationRoutes from "./routes/notifications.routes";
import washRoutes from "./routes/wash.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
    })
  );
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/vehicles", vehicleRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/sales", saleRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/membership", membershipRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/hr", hrRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/wash", washRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}