import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(3),
  address: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  const { search, page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const businessId = req.businessId!;

  const where: any = { businessId };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.customer.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const customer = await prisma.customer.findFirst({
    where: { id: Number(req.params.id), businessId },
    include: { sales: { include: { vehicle: true } } },
  });
  if (!customer) throw new ApiError(404, "Customer not found");
  res.json(customer);
});

router.post("/", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({ 
    data: { ...data, businessId } 
  });
  res.status(201).json(customer);
});

router.put("/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = customerSchema.partial().parse(req.body);
  const customer = await prisma.customer.update({
    where: { id: Number(req.params.id), businessId },
    data,
  });
  res.json(customer);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const id = Number(req.params.id);
  const saleCount = await prisma.sale.count({ where: { customerId: id, businessId } });
  if (saleCount > 0) {
    throw new ApiError(400, "Cannot delete a customer with existing sales records.");
  }
  await prisma.customer.delete({ where: { id, businessId } });
  res.status(204).send();
});

export default router;