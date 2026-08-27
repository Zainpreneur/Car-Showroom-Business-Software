export type Role = "ADMIN" | "MANAGER" | "SALESPERSON";
export type VehicleStatus = "IN_STOCK" | "RESERVED" | "SOLD";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "FINANCE" | "LEASE";
export type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  active?: boolean;
  createdAt?: string;
}

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  vin: string;
  color?: string | null;
  mileage: number;
  bodyType?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  costPrice: number;
  sellingPrice: number;
  status: VehicleStatus;
  description?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Sale {
  id: number;
  vehicleId: number;
  customerId: number;
  salespersonId: number;
  salePrice: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  saleDate: string;
  notes?: string | null;
  vehicle: Vehicle;
  customer: Customer;
  salesperson: { id: number; name: string; email?: string };
}

export interface Expense {
  id: number;
  category: string;
  description?: string | null;
  amount: number;
  date: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardSummary {
  inventory: { total: number; inStock: number; reserved: number; sold: number };
  customers: { total: number };
  sales: {
    monthCount: number;
    monthRevenue: number;
    monthProfit: number;
    yearCount: number;
    yearRevenue: number;
    yearProfit: number;
    allTimeCount: number;
    allTimeRevenue: number;
    allTimeProfit: number;
  };
  inventoryValue: number;
  monthExpenses: number;
  recentSales: Sale[];
}

export interface TrendPoint {
  label: string;
  revenue: number;
  profit: number;
  count: number;
}
