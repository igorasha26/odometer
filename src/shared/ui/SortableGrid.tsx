import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';

export interface GridItem {
  id: string;
  /** 1 — половина ряда, 2 — весь ряд. */
  span: 1 | 2;
  node: ReactNode;
}

interface Props {
  items: GridItem[];
  order: string[];
  editing: boolean;
  onReorder: (order: string[]) => void;
}

/**
 * Сетка дашборда с перестановкой блоков.
 * Перетаскивание — для мыши, стрелки — для тач-экранов и клавиатуры,
 * где HTML5 drag and drop не работает.
 */
export function SortableGrid({ items, order, editing, onReorder }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const sorted = sortItems(items, order);

  function move(id: string, delta: number) {
    const ids = sorted.map((item) => item.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onReorder(ids);
  }

  function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const ids = sorted.map((item) => item.id);
    const from = ids.indexOf(dragging);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ...ids.splice(from, 1));
    onReorder(ids);
    setDragging(null);
    setOver(null);
  }

  return (
    <div className="dash-grid">
      {sorted.map((item, index) => (
        <section
          key={item.id}
          className="dash-cell"
          data-span={item.span}
          data-editing={editing}
          data-dragging={dragging === item.id}
          data-over={over === item.id && dragging !== item.id}
          draggable={editing}
          onDragStart={() => setDragging(item.id)}
          onDragEnd={() => { setDragging(null); setOver(null); }}
          onDragOver={(e) => { if (editing) { e.preventDefault(); setOver(item.id); } }}
          onDrop={(e) => { e.preventDefault(); drop(item.id); }}
        >
          {editing && (
            <div className="dash-handle">
              <button
                className="icon-btn" onClick={() => move(item.id, -1)}
                disabled={index === 0} aria-label="Переместить выше"
              >
                <ChevronLeft />
              </button>
              <GripVertical size={15} aria-hidden />
              <button
                className="icon-btn" onClick={() => move(item.id, 1)}
                disabled={index === sorted.length - 1} aria-label="Переместить ниже"
              >
                <ChevronRight />
              </button>
            </div>
          )}
          {item.node}
        </section>
      ))}
    </div>
  );
}

/** Сохранённый порядок может устареть: новые блоки уходят в конец, исчезнувшие отбрасываются. */
export function sortItems(items: GridItem[], order: string[]): GridItem[] {
  const known = new Map(items.map((item) => [item.id, item]));
  const result: GridItem[] = [];

  for (const id of order) {
    const item = known.get(id);
    if (item) { result.push(item); known.delete(id); }
  }
  for (const item of items) {
    if (known.has(item.id)) result.push(item);
  }
  return result;
}
