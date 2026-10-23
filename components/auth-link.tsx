'use client';
import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { AuthNavigationStatus } from './auth-loading';
import styles from './auth-loading.module.css';

type Props = ComponentProps<typeof Link> & { pendingLabel?: string };

function LinkFeedback({ children, label }: { children: ReactNode; label: string }) {
  const { pending } = useLinkStatus();
  return <><span className={styles.linkContent} aria-busy={pending} data-auth-pending={pending}>
    <span className={styles.linkLabel}>{children}</span>
  </span>
    {pending && <AuthNavigationStatus label={label} compact />}
  </>;
}

/** Next owns navigation and modified clicks; feedback only reflects its pending state. */
export default function AuthLink({ children, pendingLabel = 'Opening…', className, ...props }: Props) {
  return <Link {...props} className={[className, styles.link].filter(Boolean).join(' ')} data-auth-link>
    <LinkFeedback label={pendingLabel}>{children}</LinkFeedback>
  </Link>;
}
