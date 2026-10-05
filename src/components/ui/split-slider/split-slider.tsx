import * as Slider from '@radix-ui/react-slider'

import styles from './split-slider.module.css'

export interface SplitSegment {
  label: string
  value: number
  /** The most the segment may hold; its thumbs stop there. */
  max?: number
}

interface SplitSliderProps {
  segments: readonly SplitSegment[]
  onChange: (values: number[]) => void
  label?: string
}

/** The segment values once the thumbs move to `bounds`: a thumb stops where
 *  either neighbouring segment would exceed its max. */
export function moveThumbs(
  segments: readonly SplitSegment[],
  bounds: readonly number[],
): number[] {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const clamped = bounds.map((bound, i) => {
    const low = (bounds[i + 1] ?? total) - (segments[i + 1].max ?? Infinity)
    const high = (bounds[i - 1] ?? 0) + (segments[i].max ?? Infinity)
    return Math.min(Math.max(bound, low), high)
  })
  return [...clamped, total].map((bound, i) => bound - (clamped[i - 1] ?? 0))
}

/** Divides a fixed total between ordered segments: each thumb is the border
 *  between two neighbouring segments. */
export function SplitSlider({ segments, onChange, label }: SplitSliderProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const bounds: number[] = []
  let start = 0
  for (const segment of segments.slice(0, -1)) {
    start += segment.value
    bounds.push(start)
  }
  const percent = (value: number) => `${total > 0 ? (value / total) * 100 : 0}%`
  const change = (next: number[]) => {
    const values = moveThumbs(segments, next)
    if (values.some((value, i) => value !== segments[i].value)) onChange(values)
  }

  return (
    <div className={styles.wrapper}>
      <Slider.Root
        className={styles.root}
        min={0}
        max={total}
        step={1}
        minStepsBetweenThumbs={0}
        value={bounds}
        onValueChange={change}
        aria-label={label}
      >
        <Slider.Track className={styles.track}>
          {segments.map((segment, i) => (
            <span
              key={segment.label}
              className={styles.segment}
              data-parity={i % 2}
              style={{
                left: percent(bounds[i - 1] ?? 0),
                width: percent(segment.value),
              }}
            />
          ))}
        </Slider.Track>
        {bounds.map((_, i) => (
          <Slider.Thumb
            key={segments[i].label}
            className={styles.thumb}
            aria-label={`${segments[i].label} / ${segments[i + 1].label}`}
          />
        ))}
      </Slider.Root>
      <div className={styles.legend}>
        {segments.map(segment => (
          <span key={segment.label} className={styles.legendItem}>
            <span className={styles.legendLabel}>{segment.label}</span>
            <span className={styles.legendValue}>{segment.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
