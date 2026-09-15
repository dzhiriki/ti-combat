import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandleDots2Icon, LockClosedIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useMemo } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

import { applyDragMove } from './apply-drag-move'

import styles from './list.module.css'

export interface ListItem {
  label: string
  value: string
  max?: number
  stable?: boolean
}

interface CommonProps {
  items: readonly ListItem[]
  sortable?: boolean
}

export type OrderListValue = [string][]
export type CheckboxListValue = [string, boolean][]
export type NumberListValue = [string, number][]

export type ListProps = CommonProps &
  (
    | {
        mode: 'order'
        value: OrderListValue
        onChange: (value: OrderListValue) => void
      }
    | {
        mode: 'checkbox'
        value: CheckboxListValue
        onChange: (value: CheckboxListValue) => void
      }
    | {
        mode: 'number'
        value: NumberListValue
        onChange: (value: NumberListValue) => void
      }
  )

export function List(props: ListProps): React.ReactElement {
  const sortable = props.mode === 'order' || props.sortable === true
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  )

  const stateMap = useMemo(() => {
    const m = new Map<string, boolean | number>()
    if (props.mode === 'checkbox' || props.mode === 'number') {
      for (const [k, v] of props.value) m.set(k, v)
    }
    return m
  }, [props.value, props.mode])

  const orderedItems = useMemo(() => {
    if (!sortable) return [...props.items]
    const orderIndex = new Map<string, number>()
    props.value.forEach(([id], i) => orderIndex.set(id, i))
    return [...props.items].sort(
      (a, b) =>
        (orderIndex.get(a.value) ?? Infinity) -
        (orderIndex.get(b.value) ?? Infinity),
    )
  }, [props.items, props.value, sortable])

  const stableIds = useMemo(
    () => new Set(orderedItems.filter(i => i.stable).map(i => i.value)),
    [orderedItems],
  )

  const ids = orderedItems.map(i => i.value)

  function handleToggle(id: string): void {
    if (props.mode !== 'checkbox') return
    const current = stateMap.get(id) === true
    const has = props.value.some(([k]) => k === id)
    const next: CheckboxListValue = has
      ? props.value.map(([k, v]) => (k === id ? [k, !current] : [k, v]))
      : [...props.value, [id, true]]
    props.onChange(next)
  }

  function handleCountChange(id: string, count: number): void {
    if (props.mode !== 'number') return
    const max = orderedItems.find(i => i.value === id)?.max
    const clamped = Math.max(0, max != null ? Math.min(count, max) : count)
    const has = props.value.some(([k]) => k === id)
    const next: NumberListValue = has
      ? props.value.map(([k, v]) => (k === id ? [k, clamped] : [k, v]))
      : [...props.value, [id, clamped]]
    props.onChange(next)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newIds = applyDragMove(
      ids,
      active.id as string,
      over.id as string,
      stableIds,
    )
    if (newIds == null) return
    if (props.mode === 'order') {
      props.onChange(newIds.map(id => [id]))
    } else if (props.mode === 'checkbox') {
      props.onChange(newIds.map(id => [id, stateMap.get(id) === true]))
    } else {
      props.onChange(
        newIds.map(id => [id, (stateMap.get(id) as number | undefined) ?? 0]),
      )
    }
  }

  function isActive(id: string): boolean {
    if (props.mode === 'checkbox') return stateMap.get(id) === true
    if (props.mode === 'number')
      return ((stateMap.get(id) as number | undefined) ?? 0) > 0
    return true
  }

  function renderRight(item: ListItem, index: number): React.ReactElement {
    if (props.mode === 'checkbox') {
      const checked = stateMap.get(item.value) === true
      return (
        <Checkbox
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          checked={checked}
          onChange={() => handleToggle(item.value)}
        />
      )
    }
    if (props.mode === 'number') {
      const count = (stateMap.get(item.value) as number | undefined) ?? 0
      return (
        <Input
          square
          value={count}
          active={!!count}
          min={0}
          max={item.max}
          onPointerDown={e => e.stopPropagation()}
          onChange={value => handleCountChange(item.value, value)}
        />
      )
    }
    return <span className={styles.priorityNumber}>{index + 1}</span>
  }

  if (sortable) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {orderedItems.map((item, index) => (
              <SortableRow
                key={item.value}
                id={item.value}
                label={item.label}
                active={isActive(item.value)}
                stable={item.stable === true}
                onRowClick={
                  props.mode === 'checkbox'
                    ? () => handleToggle(item.value)
                    : undefined
                }
              >
                {renderRight(item, index)}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  const isClickable = props.mode === 'checkbox'
  return (
    <div className={styles.list}>
      {orderedItems.map((item, index) => (
        <div
          key={item.value}
          className={clsx(
            styles.item,
            isActive(item.value) && styles.item_active,
            isClickable && styles.item_clickable,
          )}
          onClick={isClickable ? () => handleToggle(item.value) : undefined}
        >
          <span className={styles.label} title={item.label}>
            {item.label}
          </span>
          <div className={styles.right}>{renderRight(item, index)}</div>
        </div>
      ))}
    </div>
  )
}

interface SortableRowProps {
  id: string
  label: string
  active: boolean
  stable: boolean
  onRowClick?: () => void
  children: React.ReactNode
}

function SortableRow({
  id,
  label,
  active,
  stable,
  onRowClick,
  children,
}: SortableRowProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: { draggable: stable } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  const dragProps = stable ? {} : { ...attributes, ...listeners }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        styles.item,
        styles.item_sortable,
        active && styles.item_active,
        isDragging && styles.item_dragging,
      )}
      onClick={onRowClick}
      {...dragProps}
    >
      <span className={styles.label} title={label}>
        {label}
      </span>
      <span className={styles.dragHandle}>
        {stable ? (
          <LockClosedIcon aria-label="Fixed position" />
        ) : (
          <DragHandleDots2Icon />
        )}
      </span>
      <div className={styles.right}>{children}</div>
    </div>
  )
}
