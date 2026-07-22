"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnalyticsWidget } from "@/features/dashboards/components/analytics-widget";
import type { AnalyticsWidget as AnalyticsWidgetModel } from "@/features/dashboards/domain/analytics-widget";
import { cn } from "@/lib/utils";

function spanClass(widget: AnalyticsWidgetModel) {
  if (widget.config.kind === "traffic" || widget.config.kind === "products")
    return "md:col-span-2 xl:col-span-2";
  if (widget.config.kind === "activity") return "md:col-span-2 xl:col-span-2";
  return "md:col-span-1 xl:col-span-1";
}

function SortableWidget({ widget }: { widget: AnalyticsWidgetModel }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative min-w-0",
        spanClass(widget),
        isDragging && "z-20 opacity-70",
      )}
    >
      <Button
        aria-label={`Move ${widget.title} widget`}
        className="absolute right-3 top-3 z-10 size-7 cursor-grab touch-none opacity-0 transition-opacity focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
        size="icon"
        variant="ghost"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </Button>
      <AnalyticsWidget widget={widget} />
    </div>
  );
}

export function AnalyticsDashboardGrid({
  dashboardId,
  initialWidgets,
}: {
  dashboardId: string;
  initialWidgets: AnalyticsWidgetModel[];
}) {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const previous = widgets;
    const next = arrayMove(
      widgets,
      widgets.findIndex((item) => item.id === event.active.id),
      widgets.findIndex((item) => item.id === event.over?.id),
    );
    setWidgets(next);
    setError(null);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/layout`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ widgetIds: next.map((item) => item.id) }),
      });
      if (!response.ok) throw new Error("Unable to save the layout.");
    } catch {
      setWidgets(previous);
      setError(
        "The layout could not be saved. Your previous layout was restored.",
      );
    }
  }

  return (
    <div>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <SortableContext
          items={widgets.map((widget) => widget.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {widgets.map((widget) => (
              <SortableWidget key={widget.id} widget={widget} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
