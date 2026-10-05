import { Monitor, Moon, Sun } from 'lucide-react';
import { repository } from '../../repository';
import { useStore } from '../../app/store';
import type { ThemeMode } from '../../entities/types';

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'system', label: 'Системная', icon: Monitor },
];

export function ThemeSwitch() {
  const { settings, refresh } = useStore();
  const current = settings?.theme ?? 'system';

  async function pick(mode: ThemeMode) {
    await repository.settings.update({ theme: mode });
    refresh();
  }

  return (
    <div className="seg seg-fill">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <label key={value} className="seg-opt" title={label} aria-label={label}>
          <input
            type="radio" name="theme" aria-label={label}
            checked={current === value} onChange={() => pick(value)}
          />
          <Icon size={15} aria-hidden />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
