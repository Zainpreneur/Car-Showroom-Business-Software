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

router.get("/", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const employees = await prisma.user.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  res.json(employees);
});

router.get("/:id", requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const employee = await prisma.user.findFirst({
    where: { id: Number(req.params.id), businessId },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  if (!employee) throw new ApiError(404, "Employee not found");
  res.json(employee);
});

router.post("/", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const data = createSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 10);
  const employee = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash, role: data.role, phone: data.phone, businessId },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  res.status(201).json(employee);
});

router.put("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const id = Number(req.params.id);
  const data = updateSchema.parse(req.body);

  const updateData: Record<string, unknown> = { ...data };
  delete updateData.password;
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const employee = await prisma.user.update({
    where: { id, businessId },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
  });
  res.json(employee);
});

router.delete("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const id = Number(req.params.id);
  if (req.user!.id === id) {
    throw new ApiError(400, "You cannot delete your own account");
  }
  const salesCount = await prisma.sale.count({ where: { salespersonId: id, businessId } });
  if (salesCount > 0) {
    // Preserve sales history by deactivating instead of deleting.
    const employee = await prisma.user.update({
      where: { id, businessId },
      data: { active: false },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    return res.json({ ...employee, message: "Employee has sales history and was deactivated instead of deleted." });
  }
  await prisma.user.delete({ where: { id, businessId } });
  res.status(204).send();
});

export default router;