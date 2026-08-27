import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const vehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  vin: z.string().min(5),
  color: z.string().optional(),
  mileage: z.coerce.number().int().min(0).default(0),
  bodyType: z.string().optional(),
  transmission: z.string().optional(),
  fuelType: z.string().optional(),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  status: z.enum(["IN_STOCK", "RESERVED", "SOLD"]).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

// GET /api/vehicles?status=IN_STOCK&search=civic&page=1&pageSize=20
router.get("/", async (req, res) => {
  const { status, search, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { make: { contains: search } },
      { model: { contains: search } },
      { vin: { contains: search } },
      { color: { contains: search } },
    ];
  }

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.vehicle.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/:id", async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: Number(req.params.id) },
    include: { sale: { include: { customer: true, salesperson: true } } },
  });
  if (!vehicle) throw new ApiError(404, "Vehicle not found");
  res.json(vehicle);
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = vehicleSchema.parse(req.body);
  const vehicle = await prisma.vehicle.create({ data });
  res.status(201).json(vehicle);
});

router.put("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = vehicleSchema.partial().parse(req.body);
  const vehicle = await prisma.vehicle.update({
    where: { id: Number(req.params.id) },
    data,
  });
  res.json(vehicle);
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = Number(req.params.id);
  const sale = await prisma.sale.findUnique({ where: { vehicleId: id } });
  if (sale) {
    throw new ApiError(400, "Cannot delete a vehicle that has a sale record. Cancel the sale first.");
  }
  await prisma.vehicle.delete({ where: { id } });
  res.status(204).send();
});

export default router;
