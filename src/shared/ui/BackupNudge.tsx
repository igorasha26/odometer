import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { repository } from '../../repository';
import { useStore } from '../../app/store';
import { downloadFile } from '../lib/csv';

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Данные живут в IndexedDB: очистка данных сайта стирает их безвозвратно.
 * Напоминаем, когда есть что терять и копия давно не снималась.
 */
export function BackupNudge() {
  const { settings, cars, refresh } = useStore();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || cars.length === 0 || !settings) return null;

  const last = settings.lastExportAt ? Date.parse(settings.lastExportAt) : 0;
  if (Date.now() - last < MONTH_MS) return null;

  async function exportNow() {
    const backup = await repository.backup.export();
    downloadFile(
      JSON.stringify(backup, null, 2),
      `odometer-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    await repository.settings.update({ lastExportAt: new Date().toISOString() });
    refresh();
  }

  return (
    <div className="notice mb-6" style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
      <ShieldAlert size={18} />
      <span style={{ flex: 1, minWidth: 200 }}>
        {settings.lastExportAt
          ? 'Копию данных не выгружали больше месяца.'
          : 'Данные хранятся только в этом браузере — копии ещё не было.'}
      </span>
      <button className="btn btn-secondary" onClick={exportNow}>Скачать копию</button>
      <button className="icon-btn" onClick={() => setDismissed(true)} aria-label="Скрыть">×</button>
    </div>
  );
}
