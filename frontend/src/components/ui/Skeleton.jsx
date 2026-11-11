import { cn } from '@/lib/utils'
import './skeleton.css'

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
  return <div className={cn('card', className)}>{children}</div>
}

function PageFrame({ className, children, label = 'Loading page' }) {
  return (
    <div
      className={cn('page-stack boneyard-skeleton-page', className)}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  )
}

function TableRows({ count = 12, columns = 5 }) {
  const widths = ['12%', '32%', '18%', '14%', '12%', '10%']
  return (
    <>
      <div className="boneyard-skeleton__tr boneyard-skeleton__tr--head">
        {Array.from({ length: columns }, (_, i) => (
          <SkeletonBlock key={i} height={10} width={widths[i] || '14%'} />
        ))}
      </div>
      <div className="boneyard-skeleton__table-body">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="boneyard-skeleton__tr">
            {Array.from({ length: columns }, (_, j) => (
              <SkeletonBlock key={j} height={11} width={widths[j] || '14%'} />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function FilterToolbar() {
  return (
    <BoneCard className="boneyard-skeleton__filter">
      <SkeletonBlock height={40} width="100%" rounded={8} style={{ maxWidth: 260 }} />
      <SkeletonBlock height={40} width={120} rounded={8} />
      <SkeletonBlock height={40} width={100} rounded={8} />
      <SkeletonBlock height={40} width={88} rounded={8} />
      <SkeletonBlock height={14} width={72} style={{ marginLeft: 'auto' }} />
    </BoneCard>
  )
}

function KpiStrip({ count = 4 }) {
  return (
    <div className="boneyard-skeleton__kpis">
      {Array.from({ length: count }, (_, i) => (
        <BoneCard key={i}>
          <SkeletonBlock height={10} width="55%" style={{ marginBottom: 8 }} />
          <SkeletonBlock height={26} width="40%" style={{ marginBottom: 6 }} />
          <SkeletonBlock height={10} width="75%" />
        </BoneCard>
      ))}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--dashboard" label="Loading fleet overview">
      <div aria-hidden className="boneyard-skeleton__hero">
        <SkeletonBlock height={14} width={160} style={{ marginBottom: 12 }} />
        <div className="boneyard-skeleton__hero-kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <BoneCard key={i}>
              <SkeletonBlock height={10} width="60%" style={{ marginBottom: 8 }} />
              <SkeletonBlock height={28} width="45%" style={{ marginBottom: 6 }} />
              <SkeletonBlock height={10} width="80%" />
            </BoneCard>
          ))}
        </div>
      </div>
      <BoneCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <SkeletonBlock height={16} width={120} />
          <SkeletonBlock height={36} width={140} rounded={8} />
        </div>
        <div className="boneyard-skeleton__fleet">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="card boneyard-skeleton__fleet-card">
              <SkeletonBlock height={14} width="85%" style={{ marginBottom: 8 }} />
              <SkeletonBlock height={10} width="70%" style={{ marginBottom: 10 }} />
              <SkeletonBlock height={36} width="100%" rounded={6} style={{ marginBottom: 8 }} />
              <SkeletonBlock height={22} width="55%" rounded={999} />
            </div>
          ))}
        </div>
      </BoneCard>
      <div className="boneyard-skeleton__charts">
        <SkeletonBlock height={14} width={100} style={{ marginBottom: 12 }} />
        <div className="boneyard-skeleton__bento">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card boneyard-skeleton__chart-panel">
              <SkeletonBlock height={14} width="48%" style={{ marginBottom: 8 }} />
              <SkeletonBlock height={12} width="72%" style={{ marginBottom: 10 }} />
              <SkeletonBlock height={220} width="100%" rounded={8} style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </div>
      <BoneCard>
        <SkeletonBlock height={14} width={140} style={{ marginBottom: 10 }} />
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} height={44} width="100%" style={{ marginBottom: 8 }} rounded={8} />
        ))}
      </BoneCard>
    </PageFrame>
  )
}

function TablePageSkeleton({ tableRows = 12, withKpis = true }) {
  return (
    <PageFrame className="boneyard-skeleton--table" label="Loading table">
      {withKpis ? <KpiStrip /> : null}
      <FilterToolbar />
      <BoneCard className="boneyard-skeleton__table-card">
        <TableRows count={tableRows} />
        <p className="sr-only">Loading table data</p>
        <div className="boneyard-skeleton__pager">
          <SkeletonBlock height={36} width={36} rounded={8} />
          <SkeletonBlock height={14} width={48} />
          <SkeletonBlock height={36} width={36} rounded={8} />
        </div>
      </BoneCard>
    </PageFrame>
  )
}

function AlertsSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--alerts" label="Loading alerts">
      <div className="boneyard-skeleton__switch">
        <SkeletonBlock height={44} width={148} rounded={10} />
        <SkeletonBlock height={44} width={148} rounded={10} />
      </div>
      <KpiStrip />
      <BoneCard>
        <SkeletonBlock height={14} width={180} style={{ marginBottom: 10 }} />
        <SkeletonBlock height={200} width="100%" rounded={10} />
      </BoneCard>
      <FilterToolbar />
      <BoneCard className="boneyard-skeleton__table-card">
        <TableRows count={10} columns={6} />
      </BoneCard>
    </PageFrame>
  )
}

function OpsSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--ops" label="Loading operator console">
      <div className="boneyard-skeleton__exceptions">
        {Array.from({ length: 4 }, (_, i) => (
          <BoneCard key={i}>
            <SkeletonBlock height={10} width="50%" style={{ marginBottom: 8 }} />
            <SkeletonBlock height={28} width="35%" style={{ marginBottom: 6 }} />
            <SkeletonBlock height={10} width="70%" />
          </BoneCard>
        ))}
      </div>
      <BoneCard>
        <SkeletonBlock height={18} width={160} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={12} width="55%" style={{ marginBottom: 14 }} />
        <div className="boneyard-skeleton__switch">
          <SkeletonBlock height={36} width={320} rounded={8} />
          <SkeletonBlock height={36} width={88} rounded={8} />
        </div>
        <div className="boneyard-skeleton__queue" style={{ marginTop: 14 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card boneyard-skeleton__queue-item">
              <SkeletonBlock height={14} width="70%" />
              <SkeletonBlock height={10} width="90%" />
            </div>
          ))}
        </div>
      </BoneCard>
    </PageFrame>
  )
}

function TimelineSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--timeline" label="Loading timeline">
      <FilterToolbar />
      <BoneCard className="boneyard-skeleton__swim">
        <SkeletonBlock height={16} width={200} style={{ marginBottom: 10 }} />
        <SkeletonBlock height={12} width="60%" style={{ marginBottom: 14 }} />
        <SkeletonBlock height={280} width="100%" rounded={10} style={{ minHeight: '28vh' }} />
      </BoneCard>
      <FilterToolbar />
      <BoneCard className="boneyard-skeleton__table-card">
        <TableRows count={8} columns={6} />
      </BoneCard>
    </PageFrame>
  )
}

function GridPageSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--grid" label="Loading panels">
      <KpiStrip count={3} />
      <FilterToolbar />
      <div className="boneyard-skeleton__panels">
        {Array.from({ length: 4 }, (_, i) => (
          <BoneCard key={i} className="boneyard-skeleton__panel-tall">
            <SkeletonBlock height={16} width="42%" style={{ marginBottom: 8 }} />
            <SkeletonBlock height={12} width="68%" style={{ marginBottom: 12 }} />
            <SkeletonBlock height={280} width="100%" rounded={10} style={{ minHeight: 220 }} />
          </BoneCard>
        ))}
      </div>
    </PageFrame>
  )
}

function SettingsSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--settings" label="Loading settings">
      <div className="boneyard-skeleton__creds">
        {Array.from({ length: 4 }, (_, i) => (
          <BoneCard key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <SkeletonBlock height={16} width="55%" />
              <SkeletonBlock height={12} width={52} />
            </div>
            <SkeletonBlock height={40} width="100%" style={{ marginBottom: 8 }} />
            <SkeletonBlock height={40} width="100%" style={{ marginBottom: 10 }} />
            <SkeletonBlock height={36} width={88} rounded={8} />
          </BoneCard>
        ))}
      </div>
    </PageFrame>
  )
}

function ListSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--list" label="Loading list">
      <FilterToolbar />
      <BoneCard>
        <div className="boneyard-skeleton__queue">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="card boneyard-skeleton__queue-item">
              <SkeletonBlock height={14} width="65%" />
              <SkeletonBlock height={10} width="88%" />
            </div>
          ))}
        </div>
      </BoneCard>
    </PageFrame>
  )
}

function BackendWorkspaceSkeleton() {
  return (
    <PageFrame className="boneyard-skeleton--backend" label="Loading backend workspace">
      <BoneCard>
        <SkeletonBlock height={22} width="55%" style={{ marginBottom: 8 }} />
        <SkeletonBlock height={12} width="80%" style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBlock key={i} height={28} width={88} rounded={999} />
          ))}
        </div>
      </BoneCard>
      <div className="boneyard-skeleton__switch">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBlock key={i} height={40} width={96} rounded={8} />
        ))}
      </div>
      <div className="boneyard-skeleton__bento">
        {Array.from({ length: 2 }, (_, i) => (
          <BoneCard key={i} className="boneyard-skeleton__chart-panel">
            <SkeletonBlock height={14} width="40%" style={{ marginBottom: 10 }} />
            <SkeletonBlock height={240} width="100%" rounded={8} />
          </BoneCard>
        ))}
      </div>
    </PageFrame>
  )
}

function ChartInlineSkeleton() {
  return (
    <div className="boneyard-skeleton--inline" role="status" aria-busy="true" aria-label="Loading chart">
      <SkeletonBlock height={14} width="45%" style={{ marginBottom: 8 }} />
      <SkeletonBlock height={11} width="72%" style={{ marginBottom: 12 }} />
      <SkeletonBlock height={180} width="100%" rounded={8} />
    </div>
  )
}

/** layout: dashboard | overview | table | table-plain | alerts | ops | timeline | grid | chart | settings | list | backend */
export function BoneyardSkeleton({ layout = 'dashboard' }) {
  if (layout === 'chart') {
    return <ChartInlineSkeleton />
  }

  switch (layout) {
    case 'table':
      return <TablePageSkeleton />
    case 'table-plain':
      return <TablePageSkeleton withKpis={false} tableRows={14} />
    case 'alerts':
      return <AlertsSkeleton />
    case 'ops':
      return <OpsSkeleton />
    case 'timeline':
      return <TimelineSkeleton />
    case 'grid':
      return <GridPageSkeleton />
    case 'settings':
      return <SettingsSkeleton />
    case 'list':
      return <ListSkeleton />
    case 'backend':
      return <BackendWorkspaceSkeleton />
    case 'dashboard':
    case 'overview':
    default:
      return <OverviewSkeleton />
  }
}
