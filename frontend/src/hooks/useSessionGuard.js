import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import { clearSession, SESSION_EXPIRED_EVENT, readSessionUser } from '../lib/sessionAuth';
import { notifyWarn } from '../lib/toast';
import { safePostLoginRedirect } from '../lib/safePostLoginRedirect';

function saveReturnPath(pathname, search) {
  const path = `${pathname || ''}${search || ''}`;
  if (path.startsWith('/app/') && !path.startsWith('/app/onboarding')) {
    sessionStorage.setItem('qre_post_login_redirect', safePostLoginRedirect(path) || '/app/overview');
  }
}

/**
 * Keep React user state aligned with server session (TTL + 401).
 * onReady fires once after the first /auth/me check so the shell can wait.
 */
export function useSessionGuard(currentUser, { onEnd, onRefresh, onReady }) {
  const expiryTimerRef = useRef(null);
  const userRef = useRef(currentUser);
  const readyOnceRef = useRef(false);
  userRef.current = currentUser;

  useEffect(() => {
    readyOnceRef.current = false;
    const token = currentUser?.token;
    if (!token) {
      onReady?.();
      return undefined;
    }

    const markReady = () => {
      if (readyOnceRef.current) return;
      readyOnceRef.current = true;
      onReady?.();
    };

    const terminate = (message) => {
      if (!userRef.current) {
        markReady();
        return;
      }
      saveReturnPath(window.location.pathname, window.location.search);
      clearSession();
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      onEnd?.();
      notifyWarn(message, { toastId: 'session-expired' });
      markReady();
    };

    const onGlobalExpired = () => {
      terminate('Session ended. Sign in again.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onGlobalExpired);

    const scheduleServerExpiry = (expiresAt) => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      if (!expiresAt) return;
      const ms = expiresAt * 1000 - Date.now();
      if (ms <= 0) {
        terminate('Session expired. Sign in again.');
        return;
      }
      expiryTimerRef.current = setTimeout(() => {
        terminate('Session expired. Sign in again.');
      }, ms + 50);
    };

    const sync = async ({ isBoot } = {}) => {
      try {
        const me = await api.getMe();
        if (!me?.authenticated) {
          if (readSessionUser()?.token) {
            terminate('Session ended. Sign in again.');
          } else {
            markReady();
          }
          return;
        }
        scheduleServerExpiry(me.expires_at);
        const prev = userRef.current;
        if (!prev) {
          markReady();
          return;
        }
        const merged = {
          ...prev,
          username: me.username ?? prev.username,
          role: me.role ?? prev.role,
          role_label: me.role_label,
          permissions: me.permissions,
          full_name: me.full_name ?? prev.full_name,
          email: me.email ?? prev.email,
          org: me.org ?? prev.org,
          session_expires_at: me.expires_at,
        };
        localStorage.setItem('quantum_user', JSON.stringify(merged));
        onRefresh?.(merged);
        markReady();
      } catch (e) {
        const msg = String(e?.message || e);
        if (
          msg.includes('401')
          || /session ended/i.test(msg)
          || /authentication required/i.test(msg)
        ) {
          terminate('Session ended. Sign in again.');
        } else if (isBoot) {
          markReady();
        }
      }
    };

    sync({ isBoot: true });
    const poll = setInterval(() => sync({ isBoot: false }), 60_000);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onGlobalExpired);
      clearInterval(poll);
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [currentUser?.token, onEnd, onRefresh, onReady]);
}
