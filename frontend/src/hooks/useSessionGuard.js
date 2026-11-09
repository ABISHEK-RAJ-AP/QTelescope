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
 */
export function useSessionGuard(currentUser, { onEnd, onRefresh }) {
  const expiryTimerRef = useRef(null);
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  useEffect(() => {
    const token = currentUser?.token;
    if (!token) return undefined;

    const terminate = (message) => {
      if (!userRef.current) return;
      saveReturnPath(window.location.pathname, window.location.search);
      clearSession();
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      onEnd?.();
      notifyWarn(message, { toastId: 'session-expired' });
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

    const sync = async () => {
      try {
        const me = await api.getMe();
        if (!me?.authenticated) {
          if (readSessionUser()?.token) {
            terminate('Session ended. Sign in again.');
          }
          return;
        }
        scheduleServerExpiry(me.expires_at);
        const prev = userRef.current;
        if (!prev) return;
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
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes('401') || /authentication required/i.test(msg)) {
          terminate('Session ended. Sign in again.');
        }
      }
    };

    sync();
    const poll = setInterval(sync, 60_000);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onGlobalExpired);
      clearInterval(poll);
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [currentUser?.token, onEnd, onRefresh]);
}
