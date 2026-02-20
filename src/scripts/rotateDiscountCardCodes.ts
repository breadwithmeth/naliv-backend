import prisma, { disconnectDatabase } from '../database';
import { generateDiscountCardCode12 } from '../utils/discountCardCode';

interface ScriptOptions {
  dryRun: boolean;
  userIdMin: number;
  batchSize: number;
}

function parseArgs(argv: string[]): ScriptOptions {
  const args = new Set(argv);

  const dryRun = args.has('--dry-run');

  const userIdMinArg = argv.find((a) => a.startsWith('--user-id-min='));
  const userIdMin = userIdMinArg ? Number(userIdMinArg.split('=')[1]) : 2;

  const batchSizeArg = argv.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : 1000;

  if (!Number.isFinite(userIdMin) || userIdMin < 1) {
    throw new Error('Некорректный --user-id-min');
  }

  if (!Number.isFinite(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error('Некорректный --batch-size (1..5000)');
  }

  return { dryRun, userIdMin, batchSize };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
// Собираем список пользователей приложения
  const users = await prisma.user.findMany({
    where: {
      is_app_user: 1,
      user_id: { gte: opts.userIdMin }
    },
    select: { user_id: true },
    orderBy: { user_id: 'asc' }
  });
let created = 0;

  for (let i = 0; i < users.length; i += opts.batchSize) {
    const slice = users.slice(i, i + opts.batchSize);
    const data = slice.map((u) => ({
      user_id: u.user_id,
      card_uuid: generateDiscountCardCode12()
    }));

    if (opts.dryRun) {
      created += data.length;
continue;
    }

    // Вставляем новую запись в bonus_cards для каждого пользователя.
    // Это безопаснее, чем UPDATE: существующая история остаётся, а "последняя карта" станет новой.
    const result = await prisma.bonus_cards.createMany({ data });

    created += result.count;
}
}

main()
  .catch((err) => {
    console.error('[rotateDiscountCardCodes] failed', {
      error: err instanceof Error ? err.message : String(err)
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
