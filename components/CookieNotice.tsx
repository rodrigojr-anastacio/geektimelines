'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './CookieNotice.module.css';

const STORAGE_KEY = 'gtl-consent';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* private mode or blocked storage: stay silent rather than nag every load */
    }
  }, []);

  const decide = (value: 'accepted' | 'declined') => {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.bar} role="dialog" aria-label="Cookie notice">
      <p>
        This site will use cookies for advertising once ads are enabled. Nothing is set until you
        choose. See the <Link href="/privacy">privacy policy</Link>.
      </p>
      <div className={styles.actions}>
        <button className={styles.accept} onClick={() => decide('accepted')}>Accept</button>
        <button onClick={() => decide('declined')}>Decline</button>
      </div>
    </div>
  );
}
