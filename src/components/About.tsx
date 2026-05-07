import React, { useEffect, useState } from 'react';
import Logo from './shared/Logo';
import packageJson from '../../package.json';
import { getTranslation } from '@/translations';

interface AboutProps {
  systemLanguage?: string;
}

const About: React.FC<AboutProps> = ({ systemLanguage }) => {
  const t = getTranslation(systemLanguage);
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

      <div className="space-y-6 text-sm text-stone-600 dark:text-stone-400">
        <p>{t['about.description']}</p>

        <div className="border-t border-stone-200 dark:border-stone-800 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">{t['about.builtWith.label']}</span>
            <span className="font-medium dark:text-stone-300">{t['about.builtWith.value']}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">{t['about.license.label']}</span>
            <span className="font-medium dark:text-stone-300">{t['about.license.value']}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
