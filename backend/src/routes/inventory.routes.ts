import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  leadTimeDays: z.coerce.number().int().min(0).default(7),
});

const supplySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().default("unit"),
  quantityOnHand: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).default(10),
  warehouse: z.enum(["MAIN_CHEMICAL_ROOM", "DETAIL_BAY_STORAGE"]).default("MAIN_CHEMICAL_ROOM"),
  supplierId: z.coerce.number().int().optional(),
});

const purchaseOrderSchema = z.object({
  supplierId: z.coerce.number().int(),
  source: z.enum(["MANUAL", "ESTIMATED"]).default("MANUAL"),
  lines: z.array(z.object({
    supplyId: z.coerce.number().int(),
    quantityOrdered: z.coerce.number().min(0),
    unitCost: z.coerce.number().min(0),
  })).min(1),
});

const stockAdjustmentSchema = z.object({
  supplyId: z.coerce.number().int(),
  quantityDelta: z.coerce.number(), // negative = loss, positive = correction
  reasonCode: z.enum(["BREAKAGE", "SPILLAGE", "THEFT", "EXPIRED", "COUNT_CORRECTION"]),
  notes: z.string().optional(),
  approvedById: z.coerce.number().int(),
});

// Suppliers
router.get("/suppliers", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const suppliers = await prisma.supplier.findMany({
    where: { businessId, active: true },
    orderBy: { name: "asc" },
  });
  res.json(suppliers);
});

router.post("/suppliers", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = supplierSchema.parse(req.body);
  const supplier = await prisma.supplier.create({ data: { ...data, businessId } });
  res.status(201).json(supplier);
});

router.put("/suppliers/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = supplierSchema.partial().parse(req.body);
  const supplier = await prisma.supplier.update({
    where: { id: Number(req.params.id), businessId },
    data,
  });
  res.json(supplier);
});

// Supplies / Inventory
router.get("/supplies", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { warehouse, lowStock, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (warehouse) where.warehouse = warehouse;
  if (lowStock === "true") where.quantityOnHand = { lte: prisma.supply.fields.reorderLevel };

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.supply.findMany({
      where,
      include: { supplier: true },
      orderBy: { name: "asc" },
      take,
      skip,
    }),
    prisma.supply.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/supplies/low-stock", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const supplies = await prisma.supply.findMany({
    where: { businessId, quantityOnHand: { lte: prisma.supply.fields.reorderLevel } },
    include: { supplier: true },
    orderBy: { quantityOnHand: "asc" },
  });
  res.json(supplies);
});

router.post("/supplies", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = supplySchema.parse(req.body);
  const supply = await prisma.supply.create({ data: { ...data, businessId } });
  res.status(201).json(supply);
});

router.put("/supplies/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = supplySchema.partial().parse(req.body);
  const supply = await prisma.supply.update({
    where: { id: Number(req.params.id), businessId },
    data,
  });
  res.json(supply);
});

// Purchase Orders
router.get("/purchase-orders", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { status, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = { businessId };
  if (status) where.status = status;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, purchaseOrderLines: { include: { supply: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/purchase-orders/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { supplier: true, purchaseOrderLines: { include: { supply: true } } },
  });
  if (!po) throw new ApiError(404, "Purchase order not found");
  res.json(po);
});

router.post("/purchase-orders", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = purchaseOrderSchema.parse(req.body);

  const totalAmount = data.lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0);

  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId: data.supplierId,
      source: data.source,
      totalAmount,
      businessId,
      status: "DRAFT",
      purchaseOrderLines: {
        create: data.lines.map(line => ({
          supplyId: line.supplyId,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost,
          businessId,
        })),
      },
    },
    include: { supplier: true, purchaseOrderLines: { include: { supply: true } } },
  });

  res.status(201).json(po);
});

router.patch("/purchase-orders/:id/approve", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const po = await prisma.purchaseOrder.update({
    where: { id: Number(req.params.id), businessId },
    data: { status: "SENT", sentAt: new Date() },
  });
  res.json(po);
});

router.patch("/purchase-orders/:id/receive", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { lines } = req.body; // array of { id, quantityReceived }

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: line.quantityReceived },
      });

      // Update supply quantity
      const poLine = await tx.purchaseOrderLine.findUnique({ where: { id: line.id }, include: { supply: true } });
      if (poLine) {
        await tx.supply.update({
          where: { id: poLine.supplyId },
          data: { quantityOnHand: { increment: line.quantityReceived } },
        });
      }
    }

    // Check if all lines are fully received
    const allLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: Number(req.params.id) } });
    const allReceived = allLines.every(l => l.quantityReceived >= l.quantityOrdered);

    await tx.purchaseOrder.update({
      where: { id: Number(req.params.id), businessId },
      data: {
        status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
        receivedAt: allReceived ? new Date() : null,
      },
    });
  });

  const updated = await prisma.purchaseOrder.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { supplier: true, purchaseOrderLines: { include: { supply: true } } },
  });
  res.json(updated);
});

router.patch("/purchase-orders/:id/close", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const po = await prisma.purchaseOrder.update({
    where: { id: Number(req.params.id), businessId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  res.json(po);
});

// Stock Adjustments
router.get("/stock-adjustments", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const { page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where: { businessId },
      include: { supply: true, approvedBy: { include: { user: true } }, createdBy: true },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.stockAdjustment.count({ where: { businessId } }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.post("/stock-adjustments", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = stockAdjustmentSchema.parse(req.body);

  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.stockAdjustment.create({
      data: { ...data, businessId, userId: req.user!.id },
      include: { supply: true },
    });

    await tx.supply.update({
      where: { id: data.supplyId },
      data: { quantityOnHand: { increment: data.quantityDelta } },
    });

    return created;
  });

  res.status(201).json(adjustment);
});

export default router;