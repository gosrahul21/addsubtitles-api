import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();

async function main() {
  console.log('Seeding subscription plans...');

  const plans = [
    {
      name: 'FREE',
      price: 0.00,
      daysCovered: 99999,
      benefits: [
        'Watermarked 720p exports',
        'Auto subtitles up to 10 minute',
        'Standard subtitle styles',
      ],
      limitations: [
        'Watermark on all exports',
        'No premium features'
      ],
    },
    {
      name: 'PRO',
      price: 19.00,
      daysCovered: 30,
      benefits: [
        'No watermark 1080p exports',
        'Auto subtitles up to 30 minutes',
        'Premium subtitle styles',
        '100+ Languages Subtitle Translation',
        'Priority support'
      ],
      limitations: [],
    },
    {
      name: 'ENTERPRISE',
      price: 99.00,
      daysCovered: 30,
      benefits: [
        '4K exports',
        'Unlimited auto subtitles',
        'Custom branding & fonts',
        'Dedicated account manager'
      ],
      limitations: [],
    },
  ];

  for (const plan of plans) {
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: plan.name },
    });

    if (existingPlan) {
      await prisma.subscriptionPlan.update({
        where: { id: existingPlan.id },
        data: plan,
      });
      console.log(`Updated plan: ${plan.name}`);
    } else {
      await prisma.subscriptionPlan.create({
        data: plan,
      });
      console.log(`Created plan: ${plan.name}`);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
