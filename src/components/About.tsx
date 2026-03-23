import React from 'react';

const About: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20">
          S
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Snaplex</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">v0.1.0</p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-stone-600 dark:text-stone-400">
        <p>
          AI-powered image prompt analysis tool. Break any image into structured, reusable prompt dimensions — Subject, Environment, Composition, Lighting, Mood, and Style.
        </p>

        <div className="border-t border-stone-200 dark:border-stone-800 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Built with</span>
            <span className="font-medium dark:text-stone-300">Tauri v2 + React</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">License</span>
            <span className="font-medium dark:text-stone-300">MIT</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
