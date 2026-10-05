import { useState } from 'react';
import { Car, Fuel, Gauge, Wrench, ArrowRight, Sparkles } from 'lucide-react';
import { repository } from '../../repository';
import { seedDemoData } from '../lib/demo';

interface Step {
  icon: typeof Car;
  title: string;
  body: string;
  hint?: string;
}

const STEPS: Step[] = [
  {
    icon: Car,
    title: 'Начните с машины',
    body: 'Марка, текущий пробег и интервал ТО. Приложение сразу покажет, на каком пробеге '
      + 'делать следующее обслуживание.',
    hint: 'Заводской расход из документов пригодится, чтобы сравнивать с реальным.',
  },
  {
    icon: Fuel,
    title: 'Записывайте траты',
    body: 'Заправки, мойки, запчасти, ремонт. Категория выбирается плиткой, а сумма, литры '
      + 'и цена за литр связаны: заполните любые два поля, третье посчитается само. '
      + 'Пробег указывать необязательно — подставим последний известный.',
    hint: 'Заправляться до полного бака не обязательно — расход считается и так.',
  },
  {
    icon: Wrench,
    title: 'Отмечайте ТО и сроки',
    body: 'На ТО пробег важен: от него отсчитывается следующее обслуживание, и в гараже видно, '
      + 'когда вы его делали. В разделе «Документы» держите даты ОСАГО и диагностической карты.',
    hint: 'Приложение покажет, сколько дней осталось до конца срока.',
  },
  {
    icon: Gauge,
    title: 'Смотрите, куда уходят деньги',
    body: 'На обзоре — расходы за период, стоимость километра, структура трат и динамика расхода. '
      + 'Нажмите на столбец месяца, чтобы посмотреть только его. Блоки можно переставить.',
    hint: 'Данные хранятся только в этом браузере. Выгружайте копию в настройках.',
  },
];

export function Onboarding({ userId, onDone }: { userId?: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  async function finish(withDemo: boolean) {
    setBusy(true);
    if (withDemo) await seedDemoData(userId);
    await repository.settings.update({ onboardingDone: true });
    setBusy(false);
    onDone();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal onboarding" role="dialog" aria-modal="true" aria-label="Знакомство">
        <div className="onboarding-body">
          <div className="onboarding-icon"><Icon size={26} /></div>
          <h3>{current.title}</h3>
          <p className="text-muted">{current.body}</p>
          {current.hint && <div className="notice">{current.hint}</div>}
        </div>

        <div className="onboarding-dots" aria-hidden>
          {STEPS.map((s, index) => (
            <span key={s.title} className={index === step ? 'dot-active' : ''} />
          ))}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => finish(false)} disabled={busy}>
            Пропустить
          </button>
          {isLast ? (
            <>
              <button className="btn btn-secondary" onClick={() => finish(true)} disabled={busy}>
                <Sparkles size={15} /> Показать на примере
              </button>
              <button className="btn btn-primary" onClick={() => finish(false)} disabled={busy}>
                Начать
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setStep((v) => v + 1)}>
              Дальше <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
