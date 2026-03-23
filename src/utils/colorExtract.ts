/**
 * K-means color extraction using Canvas API.
 * Extracts dominant colors from an image URL.
 */

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  percentage: number;
  name: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function approximateColorName(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 10) return 'Black';
  if (l > 90 && s < 10) return 'White';
  if (s < 10) return 'Gray';
  if (h < 15 || h >= 345) return 'Red';
  if (h < 45) return 'Orange';
  if (h < 70) return 'Yellow';
  if (h < 160) return 'Green';
  if (h < 200) return 'Cyan';
  if (h < 260) return 'Blue';
  if (h < 300) return 'Purple';
  return 'Pink';
}

function distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

/**
 * K-means clustering on pixel data.
 */
function kmeans(pixels: number[][], k: number, maxIter: number = 20): { centers: number[][]; assignments: number[] } {
  // Initialize centers using k-means++ style
  const centers: number[][] = [pixels[Math.floor(Math.random() * pixels.length)].slice()];
  while (centers.length < k) {
    const distances = pixels.map(p => Math.min(...centers.map(c => distance(p, c))));
    const total = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pixels.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        centers.push(pixels[i].slice());
        break;
      }
    }
  }

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign pixels to nearest center
    const newAssignments = pixels.map(p => {
      let minDist = Infinity, minIdx = 0;
      centers.forEach((c, i) => {
        const d = distance(p, c);
        if (d < minDist) { minDist = d; minIdx = i; }
      });
      return minIdx;
    });

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) break;
    assignments = newAssignments;

    // Update centers
    for (let i = 0; i < k; i++) {
      const clusterPixels = pixels.filter((_, j) => assignments[j] === i);
      if (clusterPixels.length === 0) continue;
      centers[i] = clusterPixels[0].map((_, dim) =>
        Math.round(clusterPixels.reduce((sum, p) => sum + p[dim], 0) / clusterPixels.length)
      );
    }
  }

  return { centers, assignments };
}

/**
 * Extract dominant colors from an image URL using Canvas + K-means.
 */
export async function extractColors(imageUrl: string, colorCount: number = 8): Promise<ExtractedColor[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Downsample for performance
        const maxDim = 100;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const pixels: number[][] = [];
        for (let i = 0; i < data.length; i += 4) {
          // Skip very transparent pixels
          if (data[i + 3] < 128) continue;
          pixels.push([data[i], data[i + 1], data[i + 2]]);
        }

        if (pixels.length === 0) {
          resolve([]);
          return;
        }

        const k = Math.min(colorCount, pixels.length);
        const { centers, assignments } = kmeans(pixels, k);

        // Count pixels per cluster
        const counts = new Array(k).fill(0);
        assignments.forEach(a => counts[a]++);
        const total = counts.reduce((a, b) => a + b, 0);

        const colors: ExtractedColor[] = centers
          .map((c, i) => ({
            hex: rgbToHex(c[0], c[1], c[2]),
            rgb: [c[0], c[1], c[2]] as [number, number, number],
            hsl: rgbToHsl(c[0], c[1], c[2]),
            percentage: Math.round((counts[i] / total) * 1000) / 10,
            name: approximateColorName(c[0], c[1], c[2]),
          }))
          .sort((a, b) => b.percentage - a.percentage);

        resolve(colors);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for color extraction'));
    img.src = imageUrl;
  });
}
