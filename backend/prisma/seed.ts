import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@showroom.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  const admin =
    existingAdmin ??
    (await prisma.user.create({
      data: {
        name: "Admin User",
        email: adminEmail,
        passwordHash: await bcrypt.hash("Admin123!", 10),
        role: "ADMIN",
      },
    }));

  const salesperson = await prisma.user.upsert({
    where: { email: "sales@showroom.com" },
    update: {},
    create: {
      name: "Sam Salesperson",
      email: "sales@showroom.com",
      passwordHash: await bcrypt.hash("Sales123!", 10),
      role: "SALESPERSON",
    },
  });

  const vehicles = [
    {
      make: "Toyota",
      model: "Camry",
      year: 2022,
      vin: "1HGCM82633A123456",
      color: "Silver",
      mileage: 15000,
      bodyType: "Sedan",
      transmission: "Automatic",
      fuelType: "Petrol",
      costPrice: 18000,
      sellingPrice: 21500,
      status: "IN_STOCK" as const,
      description: "Well-maintained, single owner, full service history.",
    },
    {
      make: "Honda",
      model: "CR-V",
      year: 2021,
      vin: "2HGCM82633A654321",
      color: "White",
      mileage: 22000,
      bodyType: "SUV",
      transmission: "Automatic",
      fuelType: "Petrol",
      costPrice: 21000,
      sellingPrice: 24999,
      status: "IN_STOCK" as const,
      description: "Spacious family SUV with backup camera and AWD.",
    },
    {
      make: "Ford",
      model: "Mustang",
      year: 2020,
      vin: "3FAHP0HA0AR123789",
      color: "Red",
      mileage: 30500,
      bodyType: "Coupe",
      transmission: "Manual",
      fuelType: "Petrol",
      costPrice: 24000,
      sellingPrice: 28900,
      status: "RESERVED" as const,
      description: "V8 GT trim, excellent condition, aftermarket exhaust.",
    },
    {
      make: "Tesla",
      model: "Model 3",
      year: 2023,
      vin: "5YJ3E1EA0PF123456",
      color: "Blue",
      mileage: 5000,
      bodyType: "Sedan",
      transmission: "Automatic",
      fuelType: "Electric",
      costPrice: 32000,
      sellingPrice: 36500,
      status: "IN_STOCK" as const,
      description: "Long Range AWD, Autopilot included, like new.",
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { vin: v.vin },
      update: {},
      create: v,
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Jordan Buyer",
      email: "jordan@example.com",
      phone: "555-0100",
      address: "123 Main St",
    },
  });

  const mustang = await prisma.vehicle.findUnique({ where: { vin: "3FAHP0HA0AR123789" } });
  if (mustang) {
    const existingSale = await prisma.sale.findUnique({ where: { vehicleId: mustang.id } });
    if (!existingSale) {
      await prisma.sale.create({
        data: {
          vehicleId: mustang.id,
          customerId: customer.id,
          salespersonId: salesperson.id,
          salePrice: 28500,
          paymentMethod: "FINANCE",
          status: "PENDING",
          notes: "Deposit paid, financing approval pending.",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / Admin123!`);
  console.log(`Salesperson login: sales@showroom.com / Sales123!`);
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
