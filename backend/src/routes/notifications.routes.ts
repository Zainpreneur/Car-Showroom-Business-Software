import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const userId = req.user!.id;
  const { unreadOnly, limit = "50", type } = req.query as Record<string, string>;

  const where: any = { businessId, userId };
  if (unreadOnly === "true") where.read = false;
  if (type) where.type = type;

  const take = Math.min(Number(limit) || 50, 200);
  
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });

  res.json(notifications);
});

router.get("/unread-count", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const userId = req.user!.id;

  const count = await prisma.notification.count({
    where: { businessId, userId, read: false },
  });

  res.json({ count });
});

router.patch("/:id/read", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const userId = req.user!.id;

  const notification = await prisma.notification.update({
    where: { id: Number(req.params.id), businessId, userId },
    data: { read: true },
  });

  res.json(notification);
});

router.patch("/read-all", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const userId = req.user!.id;

  await prisma.notification.updateMany({
    where: { businessId, userId, read: false },
    data: { read: true },
  });

  res.json({ success: true });
});

export default router;