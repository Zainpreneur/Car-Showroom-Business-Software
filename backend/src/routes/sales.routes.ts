import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const saleSchema = z.object({
  vehicleId: z.coerce.number().int(),
  customerId: z.coerce.number().int(),
  salePrice: z.coerce.number().min(0),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "FINANCE", "LEASE"]).default("CASH"),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).default("COMPLETED"),
  saleDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

router.get("/", async (req, res) => {
  const { status, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = {};
  if (status) where.status = status;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: { vehicle: true, customer: true, salesperson: { select: { id: true, name: true, email: true } } },
      orderBy: { saleDate: "desc" },
      take,
      skip,
    }),
    prisma.sale.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/:id", async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: Number(req.params.id) },
    include: { vehicle: true, customer: true, salesperson: { select: { id: true, name: true, email: true } } },
  });
  if (!sale) throw new ApiError(404, "Sale not found");
  res.json(sale);
});

router.post("/", async (req: AuthRequest, res) => {
  const data = saleSchema.parse(req.body);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) throw new ApiError(404, "Vehicle not found");
  if (vehicle.status === "SOLD") throw new ApiError(400, "This vehicle has already been sold");

  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
  if (!customer) throw new ApiError(404, "Customer not found");

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        salespersonId: req.user!.id,
        salePrice: data.salePrice,
        paymentMethod: data.paymentMethod,
        status: data.status,
        saleDate: data.saleDate ?? new Date(),
        notes: data.notes,
      },
      include: { vehicle: true, customer: true, salesperson: { select: { id: true, name: true, email: true } } },
    });

    if (data.status !== "CANCELLED") {
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: { status: data.status === "PENDING" ? "RESERVED" : "SOLD" },
      });
    }

    return created;
  });

  res.status(201).json(sale);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = saleSchema.partial().parse(req.body);

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Sale not found");

  const sale = await prisma.$transaction(async (tx) => {
    const updated = await tx.sale.update({
      where: { id },
      data,
      include: { vehicle: true, customer: true, salesperson: { select: { id: true, name: true, email: true } } },
    });

    if (data.status) {
      const vehicleStatus = data.status === "CANCELLED" ? "IN_STOCK" : data.status === "PENDING" ? "RESERVED" : "SOLD";
      await tx.vehicle.update({ where: { id: updated.vehicleId }, data: { status: vehicleStatus } });
    }

    return updated;
  });

  res.json(sale);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Sale not found");

  await prisma.$transaction(async (tx) => {
    await tx.sale.delete({ where: { id } });
    await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: "IN_STOCK" } });
  });

  res.status(204).send();
});

export default router;
