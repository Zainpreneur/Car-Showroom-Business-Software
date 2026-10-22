import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalVehicles,
    inStock,
    reserved,
    sold,
    totalCustomers,
    salesThisMonth,
    salesThisYear,
    allCompletedSales,
    recentSales,
    monthlyExpenses,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { businessId } }),
    prisma.vehicle.count({ where: { businessId, status: "IN_STOCK" } }),
    prisma.vehicle.count({ where: { businessId, status: "RESERVED" } }),
    prisma.vehicle.count({ where: { businessId, status: "SOLD" } }),
    prisma.customer.count({ where: { businessId } }),
    prisma.sale.findMany({
      where: { businessId, status: "COMPLETED", saleDate: { gte: startOfMonth } },
      include: { vehicle: true },
    }),
    prisma.sale.findMany({
      where: { businessId, status: "COMPLETED", saleDate: { gte: startOfYear } },
      include: { vehicle: true },
    }),
    prisma.sale.findMany({ where: { businessId, status: "COMPLETED" }, include: { vehicle: true } }),
    prisma.sale.findMany({
      where: { businessId },
      orderBy: { saleDate: "desc" },
      take: 5,
      include: { vehicle: true, customer: true, salesperson: { select: { id: true, name: true } } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId, date: { gte: startOfMonth } },
    }),
  ]);

  const revenue = (sales: typeof allCompletedSales) => sales.reduce((sum, s) => sum + s.salePrice, 0);
  const profit = (sales: typeof allCompletedSales) =>
    sales.reduce((sum, s) => sum + (s.vehicle ? s.salePrice - s.vehicle.costPrice : 0), 0);

  const inventoryValue = await prisma.vehicle.aggregate({
    _sum: { costPrice: true },
    where: { businessId, status: "IN_STOCK" },
  });

  res.json({
    inventory: { total: totalVehicles, inStock, reserved, sold },
    customers: { total: totalCustomers },
    sales: {
      monthCount: salesThisMonth.length,
      monthRevenue: revenue(salesThisMonth),
      monthProfit: profit(salesThisMonth),
      yearCount: salesThisYear.length,
      yearRevenue: revenue(salesThisYear),
      yearProfit: profit(salesThisYear),
      allTimeCount: allCompletedSales.length,
      allTimeRevenue: revenue(allCompletedSales),
      allTimeProfit: profit(allCompletedSales),
    },
    inventoryValue: inventoryValue._sum.costPrice ?? 0,
    monthExpenses: monthlyExpenses._sum.amount ?? 0,
    recentSales,
  });
});

// Monthly revenue/profit trend for the last N months (default 6)
router.get("/trend", async (req: AuthRequest, res) => {
  const businessId = req.businessId!;
  const months = Math.min(Number(req.query.months) || 6, 24);
  const now = new Date();
  const results: { label: string; revenue: number; profit: number; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const sales = await prisma.sale.findMany({
      where: { businessId, status: "COMPLETED", saleDate: { gte: start, lt: end } },
      include: { vehicle: true },
    });
    const revenue = sales.reduce((sum, s) => sum + s.salePrice, 0);
    const profit = sales.reduce((sum, s) => sum + (s.vehicle ? s.salePrice - s.vehicle.costPrice : 0), 0);
    results.push({
      label: start.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      revenue,
      profit,
      count: sales.length,
    });
  }

  res.json(results);
});

export default router;