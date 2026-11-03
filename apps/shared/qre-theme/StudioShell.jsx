import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Moon, Sun, Contrast, Hexagon, X } from 'lucide-react';
import { applyTheme, readTheme, setTheme } from './theme.js';
import GlobalHeader from './GlobalHeader.jsx';
import SidebarFooter from './SidebarFooter.jsx';
import {
  readNavGroupsOpen,
  readSidebarCollapsed,
  writeNavGroupsOpen,
  writeSidebarCollapsed,
} from './navPreferences.js';
import { renderNavIcon } from './navIcon.js';

function normalizeGroups(navGroups, navItems) {
  if (navGroups?.length) return navGroups;
  if (navItems?.length) {
    return [{ id: 'main', label: 'Workspace', items: navItems.map((i) => ({ ...i, route: i.to, implemented: true })) }];
  }
  return [];
}

export default function StudioShell({
  workspaceId = 'build',
  title,
  productSubtitle = 'Quantum Resource Engine',
  brandTitle = 'QRE Platform',
  navGroups: propNavGroups,
  navItems = [],
  badges = {},
  breadcrumbs = null,
  contextLine = null,
  contextBar = null,
  children,
  topbarExtra = null,
  useGlobalHeader = true,
  showPageTitle = true,
  headerVariant = 'full',
  hideObserveLink = false,
}) {
  const [theme, setThemeState] = useState(readTheme);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const [hoverExpand, setHoverExpand] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(readNavGroupsOpen);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const slimHeader = headerVariant === 'slim';
  const desktopHover = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches;
  const showLabels = !collapsed || hoverExpand;
  const allowDevRole = import.meta.env.DEV && import.meta.env.VITE_QRE_DEV_HEADERS !== 'false';

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = () => {
      if (!mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const navGroups = useMemo(() => normalizeGroups(propNavGroups, navItems), [propNavGroups, navItems]);

  useEffect(() => {
    writeSidebarCollapsed(collapsed);
  }, [collapsed]);

  useEffect(() => {
    writeNavGroupsOpen(groupsOpen);
  }, [groupsOpen]);

  function cycleTheme() {
    const order = ['dark', 'light', 'high-contrast'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    applyTheme(next);
    setThemeState(next);
  }

  const themeBtn = (
    <button type="button" className="qre-icon-btn" onClick={cycleTheme} title="Theme" aria-label="Cycle theme">
      {theme === 'light' ? <Moon size={18} /> : theme === 'high-contrast' ? <Contrast size={18} /> : <Sun size={18} />}
    </button>
  );

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  function onNavItemActivate(item) {
    item.onClick?.();
    closeMobileNav();
  }

  const mobileNavToggle = (
    <button
      type="button"
      className="qre-mobile-nav-toggle"
      aria-expanded={mobileNavOpen}
      aria-controls="qre-primary-nav"
      aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
      onClick={() => setMobileNavOpen((o) => !o)}
    >
      {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );

  return (
    <div
      className={[
        'qre-app-shell',
        collapsed ? 'qre-app-shell--collapsed' : '',
        hoverExpand ? 'qre-app-shell--hover-expanded' : '',
        mobileNavOpen ? 'qre-app-shell--mobile-nav-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {mobileNavOpen && (
        <button type="button" className="qre-mobile-nav-backdrop" aria-label="Close navigation menu" onClick={closeMobileNav} />
      )}
      <aside
        id="qre-primary-nav"
        className="qre-sidebar"
        aria-label="Primary navigation"
        onMouseEnter={() => {
          if (collapsed && desktopHover()) setHoverExpand(true);
        }}
        onMouseLeave={() => setHoverExpand(false)}
        onFocusCapture={() => {
          if (collapsed && desktopHover()) setHoverExpand(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHoverExpand(false);
        }}
      >
        <div className="qre-sidebar__brand">
          <div className="qre-sidebar__brand-row">
            {showLabels && (
              <span className="qre-sidebar__logo" aria-hidden>
                <Hexagon size={22} strokeWidth={2.2} />
              </span>
            )}
            {showLabels && (
              <div>
                <div className="qre-sidebar__title">{brandTitle}</div>
                <div className="qre-sidebar__sub">{productSubtitle}</div>
              </div>
            )}
            <button
              type="button"
              className="qre-sidebar__collapse"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="qre-sidebar__nav">
          {navGroups.map((group) => {
            const hasActive = group.items.some((item) => item.active);
            const isOpen = hasActive || groupsOpen[group.id] !== false;
            return (
              <div key={group.id} className={`qre-nav-group${isOpen ? '' : ' qre-nav-group--closed'}`}>
                {showLabels && (
                  <button
                    type="button"
                    className="qre-nav-group__head"
                    aria-expanded={isOpen}
                    onClick={() => setGroupsOpen((prev) => ({ ...prev, [group.id]: !isOpen }))}
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={14} className={`qre-nav-group__chevron${isOpen ? ' is-open' : ''}`} aria-hidden />
                  </button>
                )}
                <div className="qre-nav-group__items" hidden={!isOpen && showLabels}>
                    {group.items.map((item) => {
                      const cls = [
                        'qre-nav-link',
                        item.active ? 'qre-nav-link--active' : '',
                        item.implemented === false ? 'qre-nav-link--planned' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const badge = item.badgeKey ? badges[item.badgeKey] : null;
                      const inner = (
                        <>
                          {renderNavIcon(item.icon)}
                          {showLabels && <span className="qre-nav-link__text">{item.label}</span>}
                          {showLabels && badge != null && badge > 0 && <span className="qre-nav-badge">{badge}</span>}
                        </>
                      );
                      if (item.externalHref) {
                        return (
                          <a
                            key={item.key}
                            href={item.externalHref}
                            className={cls}
                            title={collapsed ? item.label : undefined}
                            onClick={closeMobileNav}
                          >
                            {inner}
                          </a>
                        );
                      }
                      if (item.to) {
                        return (
                          <a
                            key={item.key}
                            href={item.to}
                            className={cls}
                            title={collapsed ? item.label : undefined}
                            onClick={(e) => {
                              if (item.onClick) {
                                e.preventDefault();
                                onNavItemActivate(item);
                              } else {
                                closeMobileNav();
                              }
                            }}
                          >
                            {inner}
                          </a>
                        );
                      }
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={cls}
                          onClick={() => onNavItemActivate(item)}
                          title={collapsed ? item.label : undefined}
                        >
                          {inner}
                        </button>
                      );
                    })}
                  </div>
              </div>
            );
          })}
        </nav>

        <SidebarFooter
          allowDevRole={allowDevRole}
          collapsed={!showLabels}
          showObserveLink={!hideObserveLink}
        />
      </aside>

      <div className="qre-main">
        {slimHeader ? (
          <header className="qre-topbar qre-topbar--slim">
            {mobileNavToggle}
            <div className="qre-topbar__titles">
              {title ? <p className="qre-topbar__title">{title}</p> : null}
              {productSubtitle ? <p className="qre-topbar__sub">{productSubtitle}</p> : null}
            </div>
            <div className="qre-topbar__actions">
              {topbarExtra}
              <button
                type="button"
                className="qre-topbar__kbd"
                aria-label="Open command palette"
                onClick={() => window.dispatchEvent(new CustomEvent('qre-open-command-palette'))}
              >
                ⌘K
              </button>
              {themeBtn}
            </div>
          </header>
        ) : useGlobalHeader ? (
          <GlobalHeader
            workspaceId={workspaceId}
            title={title}
            showPageTitle={showPageTitle}
            breadcrumbs={breadcrumbs}
            contextLine={contextLine}
            contextBar={contextBar}
            actions={topbarExtra}
            themeControl={themeBtn}
            navToggle={mobileNavToggle}
          />
        ) : (
          <header className="qre-topbar">
            <h1 className="qre-topbar__title">{title}</h1>
            <div className="qre-topbar__actions">
              {topbarExtra}
              {themeBtn}
            </div>
          </header>
        )}
        <main id="main-content" className="qre-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
