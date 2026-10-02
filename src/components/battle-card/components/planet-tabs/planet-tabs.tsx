import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Cross2Icon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

import type { SurfaceDefinition, SurfaceId } from '@/types'

import styles from './planet-tabs.module.css'

interface PlanetTabsProps {
  planets: readonly SurfaceDefinition[]
  selectedPlanetId: SurfaceId
  onSelect: (surfaceId: SurfaceId) => void
  onAdd: () => void
  onRemove: (surfaceId: SurfaceId) => void
  onReorder: (planetIds: SurfaceId[]) => void
}

/** The planet tabs of the full editor: drag to reorder (the order planets
 *  are invaded in), × to remove. */
export function PlanetTabs({
  planets,
  selectedPlanetId,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
}: PlanetTabsProps) {
  // Touch drags start on a long press so a swipe still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )
  const ids = planets.map(planet => planet.id)
  const removable = planets.length > 1

  function handleDragEnd({ active, over }: DragEndEvent): void {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id as SurfaceId)
    const to = ids.indexOf(over.id as SurfaceId)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <nav className={styles.tabs} aria-label="Planets">
          {planets.map((planet, index) => (
            <span className={styles.item} key={planet.id}>
              {index > 0 && <span className={styles.separator}>/</span>}
              <PlanetTab
                planet={planet}
                selected={planet.id === selectedPlanetId}
                sortable={removable}
                onSelect={() => onSelect(planet.id)}
                onRemove={removable ? () => onRemove(planet.id) : undefined}
              />
            </span>
          ))}
          <span className={styles.separator}>/</span>
          <button
            type="button"
            className={styles.tab}
            onClick={onAdd}
            title="Add planet"
            aria-label="Add planet"
          >
            +
          </button>
        </nav>
      </SortableContext>
    </DndContext>
  )
}

interface PlanetTabProps {
  planet: SurfaceDefinition
  selected: boolean
  sortable: boolean
  onSelect: () => void
  onRemove?: () => void
}

function PlanetTab({
  planet,
  selected,
  sortable,
  onSelect,
  onRemove,
}: PlanetTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: planet.id, disabled: !sortable })
  const dragProps = sortable ? { ...attributes, ...listeners } : {}

  return (
    <span
      ref={setNodeRef}
      className={clsx(styles.planet, isDragging && styles.planet_dragging)}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
      }}
    >
      <button
        type="button"
        {...dragProps}
        className={clsx(
          styles.tab,
          sortable && styles.tab_sortable,
          selected && styles.tab_selected,
        )}
        aria-current={selected ? 'page' : undefined}
        onClick={onSelect}
      >
        {planet.name}
      </button>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          title={`Remove ${planet.name}`}
          aria-label={`Remove ${planet.name}`}
        >
          <Cross2Icon className={styles.removeIcon} />
        </button>
      )}
    </span>
  )
}
