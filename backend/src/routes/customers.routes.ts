import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(3),
  address: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/", async (req, res) => {
  const { search, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: any = {};
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

router.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(req.params.id) },
    include: { sales: { include: { vehicle: true } } },
  });
  if (!customer) throw new ApiError(404, "Customer not found");
  res.json(customer);
});

router.post("/", async (req, res) => {
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({ data });
  res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const data = customerSchema.partial().parse(req.body);
  const customer = await prisma.customer.update({
    where: { id: Number(req.params.id) },
    data,
  });
  res.json(customer);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const saleCount = await prisma.sale.count({ where: { customerId: id } });
  if (saleCount > 0) {
    throw new ApiError(400, "Cannot delete a customer with existing sales records.");
  }
  await prisma.customer.delete({ where: { id } });
  res.status(204).send();
});

export default router;
