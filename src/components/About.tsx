import React, { useEffect, useState } from 'react';
import Logo from './shared/Logo';
import packageJson from '../../package.json';
import { getTranslation } from '@/translations';

interface AboutProps {
  systemLanguage?: string;
}

const About: React.FC<AboutProps> = ({ systemLanguage }) => {
  const t = getTranslation(systemLanguage) as any;
  const [version, setVersion] = useState<string>(packageJson.version);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const v = await getVersion();
        if (!cancelled && v) setVersion(v);
      } catch {
        // Web build or Tauri API unavailable: keep package.json version.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900/40">
      <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );

  const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 break-all text-softblue hover:underline"
    >
      {children}
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 3h7v7m0-7L10 14M5 5h6v2H7v10h10v-4h2v6H5z" />
      </svg>
    </a>
  );

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-mascot/15 bg-cream shadow-pop-sm dark:border-mascot/30 dark:bg-stone-800">
          <Logo variant="mark" size={56} className="drop-shadow-sm" />
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{t['about.title']}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">v{version}</p>
        </div>
      </div>

      <p className="mb-6 text-sm text-stone-600 dark:text-stone-400">{t['about.description']}</p>

      <div className="space-y-4">
        <Section title={t['about.section.feedback']}>
          <ExternalLink href={t['about.feedback.url']}>{t['about.feedback.label']}</ExternalLink>
          <p className="text-stone-500 dark:text-stone-400">{t['about.author.label']}</p>
          <div className="flex flex-wrap gap-3">
            <ExternalLink href={t['about.author.x']}>X</ExternalLink>
            <ExternalLink href={t['about.author.github']}>GitHub</ExternalLink>
          </div>
        </Section>

        <Section title={t['about.section.website']}>
          <ExternalLink href={t['about.website.url']}>{t['about.website.label']}</ExternalLink>
        </Section>

        <Section title={t['about.section.guide']}>
          <ExternalLink href={t['about.guide.url']}>{t['about.guide.label']}</ExternalLink>
        </Section>

        <div className="flex items-center justify-between border-t border-stone-200 px-1 pt-4 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
          <span>
            {t['about.builtWith.label']}: <span className="font-medium dark:text-stone-300">{t['about.builtWith.value']}</span>
          </span>
          <span>
            {t['about.license.label']}: <span className="font-medium dark:text-stone-300">{t['about.license.value']}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default About;
