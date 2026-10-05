import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { repository } from '../repository';
import { useStore } from '../app/store';
import { CategoryDialog } from '../shared/ui/CategoryDialog';
import { ThemeSwitch } from '../shared/ui/ThemeSwitch';
import { ConfirmDialog } from '../shared/ui/Modal';
import { CategoryIcon } from '../shared/ui/icons';
import { downloadFile } from '../shared/lib/csv';
import { seedDemoData } from '../shared/lib/demo';
import type { Category } from '../entities/types';

export function SettingsPage() {
  const { categories, settings, user, signOut, refresh } = useStore();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function exportBackup() {
    const backup = await repository.backup.export();
    downloadFile(
      JSON.stringify(backup, null, 2),
      `odometer-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    await repository.settings.update({ lastExportAt: new Date().toISOString() });
    setMessage('Резервная копия сохранена');
    refresh();
  }

  async function importBackup(file: File) {
    try {
      await repository.backup.import(JSON.parse(await file.text()), 'replace');
      setMessage('Данные восстановлены из копии');
      setError('');
      refresh();
    } catch (e) {
      setError(`Не удалось прочитать файл: ${(e as Error).message}`);
    }
  }

  async function toggleHidden(category: Category) {
    await repository.categories.update(category.id, { isHidden: !category.isHidden });
    refresh();
  }

  async function removeCategory(category: Category) {
    try {
      await repository.categories.remove(category.id);
      setError('');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadDemo() {
    await seedDemoData(user?.id);
    setMessage('Демо-данные загружены: год эксплуатации Passat B7');
    refresh();
  }

  const lastExport = settings?.lastExportAt
    ? new Date(settings.lastExportAt).toLocaleDateString('ru-RU')
    : null;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="page-kicker text-muted">Настройки</div>
          <h2>Данные и категории</h2>
        </div>
      </header>

      {(message || error) && (
        <div className={`notice ${error ? 'notice-danger' : ''} mb-6`}>{error || message}</div>
      )}

      <section className="card mb-6">
        <div className="section-title"><h4>Профиль</h4></div>
        <div className="entry-row">
          <div className="entry-icon"><UserRound size={17} /></div>
          <div className="entry-body">
            <div className="entry-title">{user?.name || user?.email}</div>
            <div className="entry-meta">{user?.name ? user.email : 'вход выполнен'}</div>
          </div>
          <button className="btn btn-secondary" onClick={signOut}>Выйти</button>
        </div>
        <p className="hint" style={{ marginTop: 'var(--sp-3)', marginBottom: 0 }}>
          Профили разделяют данные между людьми на одном устройстве. Пока нет сервера,
          это удобство, а не защита: всё хранится в браузере.
        </p>
      </section>

      <section className="card mb-6">
        <div className="section-title"><h4>Оформление</h4></div>
        <p className="text-muted" style={{ fontSize: 'var(--text-footnote)' }}>
          Системная тема следует за настройками устройства и переключается вместе с ним.
        </p>
        <ThemeSwitch />
      </section>

      <section className="card mb-6">
        <div className="section-title"><h4>Резервная копия</h4></div>
        <p className="text-muted" style={{ fontSize: 14 }}>
          Всё хранится в этом браузере. Очистка данных сайта сотрёт историю без возможности вернуть —
          выгружайте копию хотя бы раз в месяц.
          {lastExport && ` Последний экспорт: ${lastExport}.`}
        </p>
        <div className="chips">
          <button className="btn btn-primary" onClick={exportBackup}>Скачать JSON</button>
          <label className="btn btn-secondary">
            Загрузить копию
            <input
              type="file" accept="application/json" hidden
              onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
            />
          </label>
        </div>
      </section>

      <section className="card mb-6">
          <div className="section-title"><h4>Демо-данные</h4></div>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Добавит в гараж выдуманный Passat с годом эксплуатации: 31 заправка, ТО, ремонты,
            страховка и напоминания. Ваши машины и записи не тронет — демо можно потом удалить
            из гаража одной кнопкой.
          </p>
          <button className="btn btn-secondary" onClick={loadDemo}>Заполнить примером</button>
        </section>

      <section className="card">
        <div className="section-title">
          <h4>Категории</h4>
          <button className="btn btn-secondary" onClick={() => setEditing('new')}>
            <Plus size={15} /> Своя категория
          </button>
        </div>

        {categories.map((category) => (
          <div key={category.id} className="entry-row">
            <div className="entry-icon" style={{ opacity: category.isHidden ? 0.4 : 1 }}>
              <CategoryIcon kind={category.kind} name={category.name} />
            </div>
            <div className="entry-body">
              <div className="entry-title" style={{ opacity: category.isHidden ? 0.5 : 1 }}>{category.name}</div>
              <div className="entry-meta">{category.isSystem ? 'системная' : 'своя'}</div>
            </div>
            <div className="row-actions">
              <button
                className="icon-btn" onClick={() => toggleHidden(category)}
                aria-label={category.isHidden ? 'Показать' : 'Скрыть'}
              >
                {category.isHidden ? <EyeOff /> : <Eye />}
              </button>
              <button className="icon-btn" onClick={() => setEditing(category)} aria-label="Изменить"><Pencil /></button>
              {!category.isSystem && (
                <button className="icon-btn" onClick={() => setRemoving(category)} aria-label="Удалить"><Trash2 /></button>
              )}
            </div>
          </div>
        ))}
      </section>

      {editing && (
        <CategoryDialog
          category={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Удалить категорию?"
          message={`«${removing.name}». Если она используется в записях, удалить не получится — скройте её.`}
          onConfirm={() => removeCategory(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
