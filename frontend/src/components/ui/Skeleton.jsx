import { cn } from '@/lib/utils'

export function Skeleton({ className, style, ...rest }) {
  return (
    <div
      className={cn('skeleton-block', className)}
      style={style}
      aria-hidden
      {...rest}
    />
  )
}

export function SkeletonBlock({
  width = '100%',
  height = 16,
  className = '',
  style = {},
  rounded = 6,
}) {
  return (
    <Skeleton
      className={className}
      style={{ width, height, borderRadius: rounded, ...style }}
    />
  )
}

export function SkeletonRows({ rows = 4, className }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} height={12} width={i % 2 === 0 ? '100%' : '82%'} />
      ))}
    </div>
  )
}

function BoneCard({ children, className }) {
  return <div className={cn('card', className)} style={{ padding: 12 }}>{children}</div>
}

export function BoneyardSkeleton({ layout = 'dashboard' }) {
  if (layout === 'table') {
    return (
      <div className="boneyard-skeleton boneyard-skeleton--table" role="status" aria-busy="true" aria-label="Loading">
        <div className="boneyard-skeleton__toolbar">
          <SkeletonBlock height={32} width={180} />
          <SkeletonBlock height={32} width={120} />
          <SkeletonBlock height={32} width={88} style={{ marginLeft: 'auto' }} />
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="boneyard-skeleton__tr boneyard-skeleton__tr--head">
            <SkeletonBlock height={10} width="14%" />
            <SkeletonBlock height={10} width="36%" />
            <SkeletonBlock height={10} width="18%" />
            <SkeletonBlock height={10} width="14%" />
            <SkeletonBlock height={10} width="10%" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="boneyard-skeleton__tr">
              <SkeletonBlock height={11} width="12%" />
              <SkeletonBlock height={11} width="38%" />
              <SkeletonBlock height={11} width="16%" />
              <SkeletonBlock height={11} width="12%" />
              <SkeletonBlock height={11} width="10%" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === 'settings') {
    return (
      <div className="boneyard-skeleton boneyard-skeleton--settings" role="status" aria-busy="true" aria-label="Loading">
        <div className="boneyard-skeleton__creds">
          {Array.from({ length: 6 }, (_, i) => (
            <BoneCard key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <SkeletonBlock height={14} width="55%" />
                <SkeletonBlock height={12} width={52} />
              </div>
              <SkeletonBlock height={32} width="100%" style={{ marginBottom: 8 }} />
              <SkeletonBlock height={32} width="100%" style={{ marginBottom: 10 }} />
              <SkeletonBlock height={28} width={72} />
            </BoneCard>
          ))}
        </div>
      </div>
    )
  }

  if (layout === 'grid') {
    return (
      <div className="boneyard-skeleton boneyard-skeleton--grid" role="status" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <BoneCard key={i}>
            <SkeletonBlock height={14} width="60%" style={{ marginBottom: 8 }} />
            <SkeletonBlock height={28} width="40%" style={{ marginBottom: 6 }} />
            <SkeletonBlock height={11} width="80%" />
          </BoneCard>
        ))}
      </div>
    )
  }

  return (
    <div className="boneyard-skeleton boneyard-skeleton--dashboard" role="status" aria-busy="true" aria-label="Loading">
      <div className="grid-summary">
        {Array.from({ length: 5 }, (_, i) => (
          <BoneCard key={i}>
            <SkeletonBlock height={10} width="48%" style={{ marginBottom: 6 }} />
            <SkeletonBlock height={22} width="36%" style={{ marginBottom: 4 }} />
            <SkeletonBlock height={10} width="70%" />
          </BoneCard>
        ))}
      </div>
      <div className="dashboard-home-grid">
        <BoneCard>
          <SkeletonBlock height={14} width="42%" style={{ marginBottom: 8 }} />
          <SkeletonBlock height={180} width="100%" rounded={8} />
        </BoneCard>
        <BoneCard>
          <SkeletonBlock height={14} width="55%" style={{ marginBottom: 8 }} />
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonBlock key={i} height={36} width="100%" style={{ marginBottom: 6 }} rounded={6} />
          ))}
        </BoneCard>
      </div>
      <BoneCard>
        <SkeletonBlock height={14} width="36%" style={{ marginBottom: 8 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBlock key={i} height={28} width="100%" style={{ marginBottom: 6 }} rounded={4} />
        ))}
      </BoneCard>
    </div>
  )
}
