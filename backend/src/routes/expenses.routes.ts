import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().min(0),
  date: z.coerce.date().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const businessId = req.businessId!;

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.expense.findMany({ where: { businessId }, orderBy: { date: "desc" }, take, skip }),
    prisma.expense.count({ where: { businessId } }),
  ]);
  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = expenseSchema.parse(req.body);
  const expense = await prisma.expense.create({ data: { ...data, date: data.date ?? new Date(), businessId } });
  res.status(201).json(expense);
});

router.put("/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = expenseSchema.partial().parse(req.body);
  const expense = await prisma.expense.update({ where: { id: Number(req.params.id), businessId }, data });
  res.json(expense);
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  await prisma.expense.delete({ where: { id: Number(req.params.id), businessId } });
  res.status(204).send();
});

export default router;