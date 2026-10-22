import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const planSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(["BASIC", "PREMIUM", "FLEET"]),
  description: z.string().optional(),
  monthlyPrice: z.coerce.number().min(0),
  isUnlimited: z.boolean().default(true),
  washesPerMonthCap: z.coerce.number().int().min(0).optional(),
  rolloverAllowed: z.boolean().default(false),
});

const subscriptionSchema = z.object({
  customerId: z.coerce.number().int(),
  vehicleId: z.coerce.number().int().optional(),
  planId: z.coerce.number().int(),
  billingDayOfMonth: z.coerce.number().int().min(1).max(28),
});

// Membership Plans
router.get("/plans", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const plans = await prisma.membershipPlan.findMany({
    where: { businessId, active: true },
    orderBy: { monthlyPrice: "asc" },
  });
  res.json(plans);
});

router.get("/plans/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const plan = await prisma.membershipPlan.findFirst({
    where: { id: Number(req.params.id), businessId },
  });
  if (!plan) throw new ApiError(404, "Plan not found");
  res.json(plan);
});

router.post("/plans", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = planSchema.parse(req.body);
  const plan = await prisma.membershipPlan.create({ data: { ...data, businessId } });
  res.status(201).json(plan);
});

router.put("/plans/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = planSchema.partial().parse(req.body);
  const plan = await prisma.membershipPlan.update({
    where: { id: Number(req.params.id), businessId },
    data,
  });
  res.json(plan);
});

router.delete("/plans/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  await prisma.membershipPlan.delete({ where: { id: Number(req.params.id), businessId } });
  res.status(204).send();
});

// Membership Subscriptions
router.get("/subscriptions", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status, customerId, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (status) where.status = status;
  if (customerId) where.customerId = Number(customerId);

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.membershipSubscription.findMany({
      where,
      include: { customer: true, vehicle: true, plan: true },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.membershipSubscription.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/subscriptions/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const subscription = await prisma.membershipSubscription.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { customer: true, vehicle: true, plan: true },
  });
  if (!subscription) throw new ApiError(404, "Subscription not found");
  res.json(subscription);
});

router.post("/subscriptions", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = subscriptionSchema.parse(req.body);

  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, businessId } });
  if (!customer) throw new ApiError(404, "Customer not found");

  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, businessId } });
    if (!vehicle) throw new ApiError(404, "Vehicle not found");
  }

  const plan = await prisma.membershipPlan.findFirst({ where: { id: data.planId, businessId } });
  if (!plan) throw new ApiError(404, "Plan not found");

  // Check for existing active subscription for this vehicle
  if (data.vehicleId) {
    const existing = await prisma.membershipSubscription.findFirst({
      where: { vehicleId: data.vehicleId, businessId, status: { in: ["ACTIVE", "PAST_DUE"] } },
    });
    if (existing) throw new ApiError(400, "Vehicle already has an active subscription");
  }

  const subscription = await prisma.membershipSubscription.create({
    data: {
      ...data,
      businessId,
      status: "ACTIVE",
      nextBillingDate: new Date(new Date().setDate(data.billingDayOfMonth)),
    },
    include: { customer: true, vehicle: true, plan: true },
  });

  res.status(201).json(subscription);
});

router.patch("/subscriptions/:id/pause", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { until } = req.body;
  const subscription = await prisma.membershipSubscription.update({
    where: { id: Number(req.params.id), businessId },
    data: {
      status: "PAUSED",
      pausedUntil: until ? new Date(until) : null,
    },
  });
  res.json(subscription);
});

router.patch("/subscriptions/:id/resume", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const subscription = await prisma.membershipSubscription.update({
    where: { id: Number(req.params.id), businessId },
    data: {
      status: "ACTIVE",
      pausedUntil: null,
    },
  });
  res.json(subscription);
});

router.patch("/subscriptions/:id/cancel", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const subscription = await prisma.membershipSubscription.update({
    where: { id: Number(req.params.id), businessId },
    data: { status: "CANCELLED" },
  });
  res.json(subscription);
});

router.patch("/subscriptions/:id/mark-paid", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const subscription = await prisma.membershipSubscription.update({
    where: { id: Number(req.params.id), businessId },
    data: {
      status: "ACTIVE",
      failedPaymentAttempts: 0,
      firstFailedAt: null,
      washesThisCycle: 0,
      nextBillingDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    },
  });
  res.json(subscription);
});

export default router;