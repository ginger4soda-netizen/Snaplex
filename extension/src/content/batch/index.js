import { mountBatchRunner } from './runner.js';
import { collectImages as collectInstagram } from './sites/instagram.js';
import { collectImages as collectWeibo } from './sites/weibo.js';
import { collectImages as collectX } from './sites/x.js';

const host = location.hostname;

const sitePicker = () => {
  if (host.endsWith('weibo.com')) return { collectImages: collectWeibo, label: 'Send all to Snaplex' };
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) {
    return { collectImages: collectX, label: 'Send all to Snaplex' };
  }
  if (host.endsWith('instagram.com')) return { collectImages: collectInstagram, label: 'Send all to Snaplex' };
  return null;
};

const config = sitePicker();
if (config) {
  if (window.__snaplexBatchUnmount) {
    window.__snaplexBatchUnmount();
  }
  window.__snaplexBatchUnmount = mountBatchRunner(config);
}
