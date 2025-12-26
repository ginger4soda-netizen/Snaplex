/**
 * 强壮的复制到剪贴板函数
 * 自动处理 HTTPS/HTTP 环境差异和浏览器兼容性
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. 优先尝试现代 API (仅在 HTTPS 或 localhost 有效)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Modern Clipboard API failed, switching to fallback...", err);
    }
  }

  // 2. 降级方案：使用 document.execCommand (兼容性最强，支持 HTTP)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // 确保文本框在视野外但存在于 DOM 中
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  }
}