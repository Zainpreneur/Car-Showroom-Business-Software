import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const employeeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  position: z.string().min(1),
  status: z.enum(["APPLICANT", "HIRED", "ONBOARDING", "ACTIVE", "ON_LEAVE", "OFFBOARDED"]).default("ACTIVE"),
  hireDate: z.coerce.date().optional(),
  commissionRate: z.coerce.number().min(0).default(0),
  userId: z.coerce.number().int().optional(),
});

const shiftSchema = z.object({
  employeeId: z.coerce.number().int(),
  bayId: z.coerce.number().int().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: z.enum(["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"]).default("SCHEDULED"),
});

const leaveRequestSchema = z.object({
  employeeId: z.coerce.number().int(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

// Employees (HR records)
router.get("/employees", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (status) where.status = status;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/employees/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const employee = await prisma.employee.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { 
      user: { select: { id: true, name: true, email: true } },
      shifts: { orderBy: { startsAt: "desc" }, take: 10 },
      leaveRequests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!employee) throw new ApiError(404, "Employee not found");
  res.json(employee);
});

router.post("/employees", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = employeeSchema.parse(req.body);
  
  if (data.userId) {
    const user = await prisma.user.findFirst({ where: { id: data.userId, businessId } });
    if (!user) throw new ApiError(404, "User not found");
    const existing = await prisma.employee.findFirst({ where: { userId: data.userId, businessId } });
    if (existing) throw new ApiError(400, "User already has an employee record");
  }

  const employee = await prisma.employee.create({ 
    data: { ...data, businessId, hireDate: data.hireDate ?? new Date() },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json(employee);
});

router.put("/employees/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = employeeSchema.partial().parse(req.body);
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id), businessId },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(employee);
});

// Shifts
router.get("/shifts", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { employeeId, startDate, endDate, status, page = "1", pageSize = "50" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (employeeId) where.employeeId = Number(employeeId);
  if (status) where.status = status;
  if (startDate || endDate) {
    where.startsAt = {};
    if (startDate) where.startsAt.gte = new Date(startDate);
    if (endDate) where.startsAt.lte = new Date(endDate);
  }

  const take = Math.min(Number(pageSize) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: { employee: true, bay: true },
      orderBy: { startsAt: "asc" },
      take,
      skip,
    }),
    prisma.shift.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/shifts/upcoming", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const shifts = await prisma.shift.findMany({
    where: {
      businessId,
      startsAt: { gte: now, lte: endOfWeek },
      status: { in: ["SCHEDULED", "COMPLETED"] },
    },
    include: { employee: true, bay: true },
    orderBy: { startsAt: "asc" },
  });
  res.json(shifts);
});

router.post("/shifts", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = shiftSchema.parse(req.body);

  // Check for overlapping shifts for same employee
  const overlapping = await prisma.shift.findFirst({
    where: {
      employeeId: data.employeeId,
      businessId,
      status: { in: ["SCHEDULED", "COMPLETED"] },
      OR: [
        { startsAt: { lt: data.endsAt }, endsAt: { gt: data.startsAt } },
      ],
    },
  });
  if (overlapping) throw new ApiError(400, "Employee has an overlapping shift");

  const shift = await prisma.shift.create({ 
    data: { ...data, businessId },
    include: { employee: true, bay: true },
  });
  res.status(201).json(shift);
});

router.patch("/shifts/:id/clock-in", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const shift = await prisma.shift.update({
    where: { id: Number(req.params.id), businessId },
    data: { checkedInAt: new Date(), status: "COMPLETED" },
    include: { employee: true },
  });
  res.json(shift);
});

router.patch("/shifts/:id/clock-out", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const shift = await prisma.shift.update({
    where: { id: Number(req.params.id), businessId },
    data: { checkedOutAt: new Date(), status: "COMPLETED" },
    include: { employee: true },
  });
  res.json(shift);
});

router.delete("/shifts/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  await prisma.shift.delete({ where: { id: Number(req.params.id), businessId } });
  res.status(204).send();
});

// Leave Requests
router.get("/leave-requests", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { employeeId, status, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (employeeId) where.employeeId = Number(employeeId);
  if (status) where.status = status;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: { employee: true, approvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.post("/leave-requests", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = leaveRequestSchema.parse(req.body);

  // Check for approved overlapping leave
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: data.employeeId,
      businessId,
      status: "APPROVED",
      OR: [
        { startDate: { lte: data.endDate }, endDate: { gte: data.startDate } },
      ],
    },
  });
  if (overlapping) throw new ApiError(400, "Employee has approved leave during this period");

  const leave = await prisma.leaveRequest.create({
    data: { ...data, businessId, status: "PENDING" },
    include: { employee: true },
  });
  res.status(201).json(leave);
});

router.patch("/leave-requests/:id/decision", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status } = req.body; // APPROVED | DENIED
  if (!["APPROVED", "DENIED"].includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const leave = await prisma.leaveRequest.update({
    where: { id: Number(req.params.id), businessId },
    data: { status, approvedById: req.user!.id },
    include: { employee: true },
  });
  res.json(leave);
});

export default router;