import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const washOrderSchema = z.object({
  customerId: z.coerce.number().int().optional(),
  vehicleId: z.coerce.number().int().optional(),
  packageId: z.coerce.number().int().optional(),
  serviceBayId: z.coerce.number().int().optional(),
  assignedTechnicianId: z.coerce.number().int().optional(),
  bookingType: z.enum(["WALK_IN", "APPOINTMENT"]).default("WALK_IN"),
  scheduledFor: z.coerce.date().optional(),
  status: z.enum(["QUEUED", "BAY_ASSIGNED", "IN_WASH", "QUALITY_CHECK", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"]).default("QUEUED"),
  price: z.coerce.number().min(0),
  paymentMethod: z.enum(["MEMBERSHIP", "CARD", "CASH", "FLEET_INVOICE"]).default("CASH"),
  promoCode: z.string().optional(),
});

const packageSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(["EXPRESS", "EXTERIOR_PLUS", "SIGNATURE", "PREMIUM_HAND_DETAIL"]),
  description: z.string().optional(),
  avgCycleTimeMinutes: z.coerce.number().int().min(1).default(30),
});

const vehicleTypePricingSchema = z.object({
  vehicleType: z.enum(["SEDAN", "SUV", "VAN", "MOTORCYCLE"]),
  price: z.coerce.number().min(0),
  estimatedDurationMinutes: z.coerce.number().int().min(1).default(30),
});

const serviceBaySchema = z.object({
  bayNumber: z.coerce.number().int(),
  bayType: z.enum(["TUNNEL_CONVEYOR", "DETAIL_BAY"]),
  status: z.enum(["OPERATIONAL", "DEGRADED", "DOWN", "RETIRED"]).default("OPERATIONAL"),
  avgThroughputPerHour: z.coerce.number().min(0).optional(),
});

// Wash Orders
router.get("/orders", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (status) where.status = status;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.washOrder.findMany({
      where,
      include: { customer: true, vehicle: true, package: true, serviceBay: true, assignedTechnician: { select: { id: true, name: true } } },
      orderBy: { queuedAt: "desc" },
      take,
      skip,
    }),
    prisma.washOrder.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/orders/today", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const orders = await prisma.washOrder.findMany({
    where: {
      businessId,
      queuedAt: { gte: today, lt: tomorrow },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    include: { customer: true, vehicle: true, package: true, serviceBay: true, assignedTechnician: { select: { id: true, name: true } } },
    orderBy: { queuedAt: "asc" },
  });

  res.json(orders);
});

router.get("/orders/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const order = await prisma.washOrder.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { customer: true, vehicle: true, package: true, serviceBay: true, assignedTechnician: { select: { id: true, name: true } } },
  });
  if (!order) throw new ApiError(404, "Wash order not found");
  res.json(order);
});

router.post("/orders", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = washOrderSchema.parse(req.body);

  if (data.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, businessId } });
    if (!customer) throw new ApiError(404, "Customer not found");
  }

  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, businessId } });
    if (!vehicle) throw new ApiError(404, "Vehicle not found");
  }

  if (data.packageId) {
    const pkg = await prisma.washPackage.findFirst({ where: { id: data.packageId, businessId } });
    if (!pkg) throw new ApiError(404, "Package not found");
  }

  if (data.serviceBayId) {
    const bay = await prisma.serviceBay.findFirst({ where: { id: data.serviceBayId, businessId } });
    if (!bay) throw new ApiError(404, "Service bay not found");
  }

  if (data.assignedTechnicianId) {
    const tech = await prisma.user.findFirst({ where: { id: data.assignedTechnicianId, businessId } });
    if (!tech) throw new ApiError(404, "Technician not found");
  }

  // Get next queue position
  const lastOrder = await prisma.washOrder.findFirst({
    where: { businessId, status: { in: ["QUEUED", "BAY_ASSIGNED", "IN_WASH", "QUALITY_CHECK"] } },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  });

  const order = await prisma.washOrder.create({
    data: {
      ...data,
      businessId,
      orderNumber: `WO-${Date.now()}`,
      queuedAt: new Date(),
      queuePosition: (lastOrder?.queuePosition ?? 0) + 1,
      createdById: req.user!.id,
    },
    include: { customer: true, vehicle: true, package: true, serviceBay: true },
  });

  res.status(201).json(order);
});

router.patch("/orders/:id/assign-bay", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { serviceBayId } = req.body;

  const bay = await prisma.serviceBay.findFirst({ where: { id: serviceBayId, businessId } });
  if (!bay) throw new ApiError(404, "Service bay not found");
  if (bay.status !== "OPERATIONAL") throw new ApiError(400, "Service bay is not operational");

  const order = await prisma.washOrder.update({
    where: { id: Number(req.params.id), businessId },
    data: {
      serviceBayId,
      bayAssignedAt: new Date(),
      status: "BAY_ASSIGNED",
    },
    include: { serviceBay: true },
  });

  res.json(order);
});

router.patch("/orders/:id/start-wash", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const order = await prisma.washOrder.update({
    where: { id: Number(req.params.id), businessId, status: "BAY_ASSIGNED" },
    data: {
      washStartedAt: new Date(),
      status: "IN_WASH",
    },
  });
  if (!order) throw new ApiError(404, "Order not found or not in correct status");
  res.json(order);
});

router.patch("/orders/:id/complete-wash", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const order = await prisma.washOrder.update({
    where: { id: Number(req.params.id), businessId, status: "IN_WASH" },
    data: {
      washCompletedAt: new Date(),
      status: "QUALITY_CHECK",
    },
  });
  if (!order) throw new ApiError(404, "Order not found or not in correct status");
  res.json(order);
});

router.patch("/orders/:id/qc", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { qcResult } = req.body; // PASS | FAIL

  if (!["PASS", "FAIL"].includes(qcResult)) {
    throw new ApiError(400, "Invalid QC result");
  }

  const order = await prisma.washOrder.update({
    where: { id: Number(req.params.id), businessId, status: "QUALITY_CHECK" },
    data: {
      qcResult,
      status: qcResult === "PASS" ? "READY_FOR_PICKUP" : "IN_WASH",
    },
  });
  if (!order) throw new ApiError(404, "Order not found or not in correct status");
  res.json(order);
});

router.patch("/orders/:id/checkout", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const order = await prisma.washOrder.update({
    where: { id: Number(req.params.id), businessId, status: "READY_FOR_PICKUP" },
    data: {
      checkedOutAt: new Date(),
      status: "COMPLETED",
    },
  });
  if (!order) throw new ApiError(404, "Order not found or not in correct status");
  res.json(order);
});

router.patch("/orders/:id/cancel", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const order = await prisma.washOrder.update({
    where: { id: Number(req.params.id), businessId, status: { in: ["QUEUED", "BAY_ASSIGNED"] } },
    data: { status: "CANCELLED" },
  });
  if (!order) throw new ApiError(404, "Order not found or cannot be cancelled");
  res.json(order);
});

// Wash Packages
router.get("/packages", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const packages = await prisma.washPackage.findMany({
    where: { businessId, active: true },
    include: { vehicleTypePricings: true, packagePricings: { include: { supply: true } } },
    orderBy: { avgCycleTimeMinutes: "asc" },
  });
  res.json(packages);
});

router.get("/packages/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const pkg = await prisma.washPackage.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { vehicleTypePricings: true, packagePricings: { include: { supply: true } } },
  });
  if (!pkg) throw new ApiError(404, "Package not found");
  res.json(pkg);
});

router.post("/packages", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = packageSchema.parse(req.body);
  const pkg = await prisma.washPackage.create({ data: { ...data, businessId } });
  res.status(201).json(pkg);
});

router.put("/packages/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = packageSchema.partial().parse(req.body);
  const pkg = await prisma.washPackage.update({
    where: { id: Number(req.params.id), businessId },
    data,
  });
  res.json(pkg);
});

router.post("/packages/:id/vehicle-pricing", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = vehicleTypePricingSchema.parse(req.body);
  const pricing = await prisma.vehicleTypePricing.create({
    data: { ...data, packageId: Number(req.params.id), businessId },
  });
  res.status(201).json(pricing);
});

router.delete("/packages/:id/vehicle-pricing/:pricingId", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  await prisma.vehicleTypePricing.delete({
    where: { id: Number(req.params.pricingId), businessId },
  });
  res.status(204).send();
});

// Service Bays
router.get("/service-bays", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const bays = await prisma.serviceBay.findMany({
    where: { businessId },
    include: { shifts: { where: { status: { in: ["SCHEDULED", "COMPLETED"] } }, include: { employee: true } } },
    orderBy: { bayNumber: "asc" },
  });
  res.json(bays);
});

router.get("/service-bays/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const bay = await prisma.serviceBay.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { shifts: { include: { employee: true } } },
  });
  if (!bay) throw new ApiError(404, "Service bay not found");
  res.json(bay);
});

router.post("/service-bays", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = serviceBaySchema.parse(req.body);

  const existing = await prisma.serviceBay.findFirst({ where: { bayNumber: data.bayNumber, businessId } });
  if (existing) throw new ApiError(400, "Bay number already exists");

  const bay = await prisma.serviceBay.create({ data: { ...data, businessId } });
  res.status(201).json(bay);
});

router.put("/service-bays/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = serviceBaySchema.partial().parse(req.body);
  const bay = await prisma.serviceBay.update({
    where: { id: Number(req.params.id), businessId },
    data,
  });
  res.json(bay);
});

router.delete("/service-bays/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  await prisma.serviceBay.delete({ where: { id: Number(req.params.id), businessId } });
  res.status(204).send();
});

export default router;