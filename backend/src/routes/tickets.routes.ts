import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const ticketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["DAMAGE_CLAIM", "BILLING_DISPUTE", "QUALITY_COMPLAINT", "MEMBERSHIP_QUESTION", "GENERAL"]).default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  source: z.enum(["WHATSAPP", "PHONE", "GOOGLE_BUSINESS_PROFILE", "IN_APP"]).default("IN_APP"),
  customerId: z.coerce.number().int().optional(),
  assignedToId: z.coerce.number().int().optional(),
});

const commentSchema = z.object({
  body: z.string().min(1),
  authorType: z.enum(["STAFF", "SYSTEM"]).default("STAFF"),
});

router.get("/", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status, category, priority, customerId, assignedToId, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (status) where.status = status;
  if (category) where.category = category;
  if (priority) where.priority = priority;
  if (customerId) where.customerId = Number(customerId);
  if (assignedToId) where.assignedToId = Number(assignedToId);

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { customer: true, assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const ticket = await prisma.ticket.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { 
      customer: true, 
      assignedTo: { select: { id: true, name: true } },
      comments: { 
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) throw new ApiError(404, "Ticket not found");
  res.json(ticket);
});

router.post("/", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = ticketSchema.parse(req.body);

  if (data.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, businessId } });
    if (!customer) throw new ApiError(404, "Customer not found");
  }

  if (data.assignedToId) {
    const assignee = await prisma.user.findFirst({ where: { id: data.assignedToId, businessId } });
    if (!assignee) throw new ApiError(404, "Assignee not found");
  }

  const ticket = await prisma.ticket.create({
    data: { ...data, businessId, status: "OPEN" },
    include: { customer: true, assignedTo: { select: { id: true, name: true } } },
  });

  // Create notification for assignee
  if (data.assignedToId) {
    await prisma.notification.create({
      data: {
        userId: data.assignedToId,
        type: "TICKET",
        title: "New Ticket Assigned",
        message: `Ticket "${data.subject}" has been assigned to you`,
        relatedId: ticket.id,
        relatedType: "ticket",
        businessId,
      },
    });
  }

  res.status(201).json(ticket);
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = ticketSchema.partial().parse(req.body);

  const ticket = await prisma.ticket.update({
    where: { id: Number(req.params.id), businessId },
    data,
    include: { customer: true, assignedTo: { select: { id: true, name: true } } },
  });

  // Notify assignee if changed
  if (data.assignedToId && data.assignedToId !== ticket.assignedToId) {
    await prisma.notification.create({
      data: {
        userId: data.assignedToId,
        type: "TICKET",
        title: "Ticket Reassigned",
        message: `Ticket "${ticket.subject}" has been reassigned to you`,
        relatedId: ticket.id,
        relatedType: "ticket",
        businessId,
      },
    });
  }

  res.json(ticket);
});

router.patch("/:id/status", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status } = req.body;
  const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const ticket = await prisma.ticket.update({
    where: { id: Number(req.params.id), businessId },
    data: {
      status,
      ...(status === "RESOLVED" && { resolvedAt: new Date() }),
      ...(status === "CLOSED" && { closedAt: new Date() }),
    },
    include: { customer: true, assignedTo: { select: { id: true, name: true } } },
  });

  res.json(ticket);
});

router.post("/:id/comments", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = commentSchema.parse(req.body);

  const ticket = await prisma.ticket.findFirst({ where: { id: Number(req.params.id), businessId } });
  if (!ticket) throw new ApiError(404, "Ticket not found");

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: req.user!.id,
      authorType: data.authorType,
      body: data.body,
      businessId,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  // Notify customer if staff comments (for future customer portal)
  if (ticket.customerId && data.authorType === "STAFF") {
    // Could add customer notification here
  }

  res.status(201).json(comment);
});

router.patch("/:id/assign", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { assignedToId } = req.body;

  const ticket = await prisma.ticket.update({
    where: { id: Number(req.params.id), businessId },
    data: { 
      assignedToId,
      status: assignedToId ? "IN_PROGRESS" : "OPEN",
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  if (assignedToId) {
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        type: "TICKET",
        title: "Ticket Assigned",
        message: `Ticket "${ticket.subject}" has been assigned to you`,
        relatedId: ticket.id,
        relatedType: "ticket",
        businessId,
      },
    });
  }

  res.json(ticket);
});

export default router;