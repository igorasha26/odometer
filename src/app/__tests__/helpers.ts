import { db, resetSeedCache, seedIfEmpty } from '../../repository/db';
import { repository } from '../../repository';
import { createSalt, hashPassword } from '../../shared/lib/auth';

/** Чистая база с вошедшим пользователем — исходная точка для тестов экранов. */
export async function resetWithUser(options: { onboarded?: boolean } = {}) {
  await Promise.all([
    db.cars.clear(), db.categories.clear(), db.entries.clear(),
    db.reminders.clear(), db.settings.clear(), db.users.clear(),
  ]);
  resetSeedCache();
  await seedIfEmpty();

  const salt = createSalt();
  const user = await repository.users.create({
    email: 'igor@mail.ru',
    salt,
    passwordHash: await hashPassword('parol1234', salt),
  });
  await repository.settings.update({
    currentUserId: user.id,
    onboardingDone: options.onboarded ?? true,
  });
  return user;
}
