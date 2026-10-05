import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, onClose, children, footer }: Props) {
  // Escape закрывает, фон под модалкой не скроллится.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h4>{title}</h4>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X /></button>
        </header>
        <AutoHeight className="modal-body">{children}</AutoHeight>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title, message, confirmLabel = 'Удалить', onConfirm, onClose,
}: {
  title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }
    >
      <p className="text-muted" style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}

/**
 * Контейнер, плавно меняющий высоту вслед за содержимым.
 *
 * Высота auto не анимируется, поэтому реальный размер снимается через
 * ResizeObserver и подставляется в стиль: смена категории добавляет или убирает
 * поля, и без этого окно скачком меняет размер.
 */
function AutoHeight({ className, children }: { className?: string; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;

    const apply = () => setHeight(element.getBoundingClientRect().height);
    apply();
    // Первый кадр без перехода: иначе окно «вырастает» при открытии.
    const raf = requestAnimationFrame(() => setReady(true));

    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf);
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div
      className={className}
      data-animated={ready}
      style={{ height: height === undefined ? undefined : `${height}px` }}
    >
      <div ref={inner} className="auto-height-inner">{children}</div>
    </div>
  );
}
