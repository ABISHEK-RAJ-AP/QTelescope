import React, { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';

const SPAN_CYCLE = ['compact', 'medium', 'full'];

function nextSpan(current) {
  const idx = SPAN_CYCLE.indexOf(current === 'wide' ? 'medium' : current);
  const nextIdx = idx < 0 ? 1 : (idx + 1) % SPAN_CYCLE.length;
  return SPAN_CYCLE[nextIdx];
}

function BentoItem({ id, span, children }) {
  return (
    <div className={`dash-bento__item dash-bento__item--${span}`} data-widget-id={id}>
      {children}
    </div>
  );
}

function SortableDashboardItem({
  id, span, customizing, onSpanChange, children,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !customizing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`dash-bento__item dash-bento__item--${span}${customizing ? ' dash-bento__item--customizing' : ''}${isDragging ? ' dash-bento__item--dragging' : ''}`}
      data-widget-id={id}
    >
      {customizing && (
        <div className="dash-bento__controls">
          <button
            type="button"
            className="dash-bento__handle"
            aria-label={`Drag to reorder ${id}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="dash-bento__resize"
            aria-label={`Resize ${id} panel`}
            title="Cycle panel width (compact / half / full row)"
            onClick={() => onSpanChange?.(id, nextSpan(span))}
          >
            {span === 'full' ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

export function DashboardBentoGrid({
  widgets = [],
  customizing = false,
  onReorder,
  onSpanChange,
  renderWidget,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => widgets.map((w) => w.id), [widgets]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...ids];
    next.splice(oldIndex, 1);
    next.splice(newIndex, 0, active.id);
    onReorder?.(next);
  };

  const grid = (
    <div className={`dash-bento${customizing ? ' dash-bento--customizing' : ''}`}>
      {widgets.map((widget) => {
        const content = renderWidget(widget.id);
        if (content == null) return null;
        if (!customizing) {
          return (
            <BentoItem key={widget.id} id={widget.id} span={widget.span}>
              {content}
            </BentoItem>
          );
        }
        return (
          <SortableDashboardItem
            key={widget.id}
            id={widget.id}
            span={widget.span}
            customizing={customizing}
            onSpanChange={onSpanChange}
          >
            {content}
          </SortableDashboardItem>
        );
      })}
    </div>
  );

  if (!customizing) return grid;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
}
