// src/utils/sound.ts

// 引入音频文件
import clickFile from '../sounds/click.mp3';
import printFile from '../sounds/print.mp3';

const SOUND_FILES = {
  click: clickFile,
  print: printFile
};

// 1. 单次播放 (用于按键)
export const playSound = (type: 'click') => {
  try {
    const audio = new Audio(SOUND_FILES[type]);
    audio.volume = 0.6; // 按键声稍大
    audio.play().catch(() => {
      // 忽略浏览器的自动播放限制
    });
  } catch (e) {
    console.error("Play sound error:", e);
  }
};

// 2. 持续播放 (用于打印过程) - 返回一个停止函数
export const startPrintSound = () => {
  try {
    const audio = new Audio(SOUND_FILES.print);
    audio.loop = true; // ✅ 关键：设为循环播放
    audio.volume = 0.5;
    
    audio.play().catch(() => {});

    // 返回一个函数，组件调用它就可以立刻停止声音
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  } catch (e) {
    console.error("Print sound error:", e);
    return () => {}; // 出错时返回空函数，防止组件报错
  }
};