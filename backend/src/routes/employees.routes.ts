import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "SALESPERSON"]).default("SALESPERSON"),
  phone: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "MANAGER", "SALESPERSON"]).optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.get("/", requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  const employees = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  res.json(employees);
});

router.get("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const employee = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  if (!employee) throw new ApiError(404, "Employee not found");
  res.json(employee);
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 10);
  const employee = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash, role: data.role, phone: data.phone },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  res.status(201).json(employee);
});

router.put("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const data = updateSchema.parse(req.body);

  const updateData: Record<string, unknown> = { ...data };
  delete updateData.password;
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const employee = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  res.json(employee);
});

router.delete("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (req.user!.id === id) {
    throw new ApiError(400, "You cannot delete your own account");
  }
  const salesCount = await prisma.sale.count({ where: { salespersonId: id } });
  if (salesCount > 0) {
    // Preserve sales history by deactivating instead of deleting.
    const employee = await prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    return res.json({ ...employee, message: "Employee has sales history and was deactivated instead of deleted." });
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
