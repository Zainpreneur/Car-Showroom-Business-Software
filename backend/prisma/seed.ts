import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create or find the demo business (without owner initially)
  const business = await prisma.business.upsert({
    where: { name: "Demo Showroom" },
    update: {},
    create: {
      name: "Demo Showroom",
      description: "Demo car showroom for testing",
    },
  });

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
        businessId: business.id,
      },
    }));

  // Update business owner
  await prisma.business.update({
    where: { id: business.id },
    data: { ownerId: admin.id },
  });

  const salesperson = await prisma.user.upsert({
    where: { email: "sales@showroom.com" },
    update: {},
    create: {
      name: "Sam Salesperson",
      email: "sales@showroom.com",
      passwordHash: await bcrypt.hash("Sales123!", 10),
      role: "SALESPERSON",
      businessId: business.id,
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
      businessId: business.id,
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
      businessId: business.id,
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
      businessId: business.id,
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
      businessId: business.id,
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { vin_businessId: { vin: v.vin, businessId: business.id } },
      update: {},
      create: v,
    });
  }

  const customer = await prisma.customer.upsert({
    where: { email_businessId: { email: "jordan@example.com", businessId: business.id } },
    update: {},
    create: {
      name: "Jordan Buyer",
      email: "jordan@example.com",
      phone: "555-0100",
      address: "123 Main St",
      businessId: business.id,
    },
  });

  const mustang = await prisma.vehicle.findUnique({ where: { vin_businessId: { vin: "3FAHP0HA0AR123789", businessId: business.id } } });
  if (mustang) {
    const existingSale = await prisma.sale.findUnique({ where: { vehicleId_businessId: { vehicleId: mustang.id, businessId: business.id } } });
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
          businessId: business.id,
        },
      });
    }
  }

  // Seed membership plans
  await prisma.membershipPlan.upsert({
    where: { name_businessId: { name: "Basic Unlimited", businessId: business.id } },
    update: {},
    create: {
      name: "Basic Unlimited",
      tier: "BASIC",
      description: "Unlimited basic washes",
      monthlyPrice: 29.99,
      isUnlimited: true,
      active: true,
      businessId: business.id,
    },
  });

  await prisma.membershipPlan.upsert({
    where: { name_businessId: { name: "Premium Unlimited", businessId: business.id } },
    update: {},
    create: {
      name: "Premium Unlimited",
      tier: "PREMIUM",
      description: "Unlimited premium washes with wax",
      monthlyPrice: 49.99,
      isUnlimited: true,
      active: true,
      businessId: business.id,
    },
  });

  // Seed service bays
  await prisma.serviceBay.upsert({
    where: { bayNumber_businessId: { bayNumber: 1, businessId: business.id } },
    update: {},
    create: {
      bayNumber: 1,
      bayType: "DETAIL_BAY",
      status: "OPERATIONAL",
      avgThroughputPerHour: 2,
      businessId: business.id,
    },
  });

  await prisma.serviceBay.upsert({
    where: { bayNumber_businessId: { bayNumber: 2, businessId: business.id } },
    update: {},
    create: {
      bayNumber: 2,
      bayType: "DETAIL_BAY",
      status: "OPERATIONAL",
      avgThroughputPerHour: 2,
      businessId: business.id,
    },
  });

  // Seed wash packages
  await prisma.washPackage.upsert({
    where: { name_businessId: { name: "Express Detail", businessId: business.id } },
    update: {},
    create: {
      name: "Express Detail",
      tier: "EXPRESS",
      description: "Quick exterior wash and interior wipe",
      avgCycleTimeMinutes: 30,
      active: true,
      businessId: business.id,
    },
  });

  await prisma.washPackage.upsert({
    where: { name_businessId: { name: "Full Detail", businessId: business.id } },
    update: {},
    create: {
      name: "Full Detail",
      tier: "SIGNATURE",
      description: "Complete interior and exterior detail",
      avgCycleTimeMinutes: 120,
      active: true,
      businessId: business.id,
    },
  });

  console.log("Seed complete.");
  console.log(`Business: ${business.name} (${business.id})`);
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