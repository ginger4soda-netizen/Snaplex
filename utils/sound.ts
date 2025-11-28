// src/utils/sound.ts

import ambientFile from '../sounds/ambient.mp3';
import clickFile from '../sounds/click.mp3';
import printFile from '../sounds/print.mp3';

// ✅ 核心修复：在文件加载时直接创建 Audio 对象 (预加载)
// 这样点击时就不需要等待加载，瞬间播放
const AUDIO_CACHE = {
  click: new Audio(clickFile),
  print: new Audio(printFile),
  ambient: new Audio(ambientFile)
};

// 预先设置音量和循环属性
AUDIO_CACHE.click.volume = 0.6;
AUDIO_CACHE.print.volume = 0.5;
AUDIO_CACHE.ambient.volume = 0.2;
AUDIO_CACHE.ambient.loop = true;
// 为 print 单独开启循环，稍后在逻辑里控制停止
AUDIO_CACHE.print.loop = true; 

type SoundType = 'click' | 'print';

// 1. 播放短音效
export const playSound = (type: 'click') => {
  try {
    const audio = AUDIO_CACHE[type];
    audio.currentTime = 0; // 每次播放前重置进度，保证连点也能响
    audio.play().catch(() => {}); // 忽略自动播放限制错误
  } catch (e) {
    console.error("Play sound error:", e);
  }
};

// 2. 持续播放 (用于打印)
export const startPrintSound = () => {
  try {
    const audio = AUDIO_CACHE.print;
    audio.currentTime = 0;
    audio.play().catch(() => {});

    // 返回停止函数
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  } catch (e) {
    console.error("Print sound error:", e);
    return () => {};
  }
};