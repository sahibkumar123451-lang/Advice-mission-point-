export async function compressImageToDataUrl(
  file: File,
  maxWidth = 1400,
  maxBytes = 420_000,
): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    return null;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        for (const quality of [0.84, 0.72, 0.58, 0.44]) {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length <= maxBytes) {
            URL.revokeObjectURL(objectUrl);
            resolve(dataUrl);
            return;
          }
        }
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

export async function readSmallPdfAsDataUrl(
  file: File,
  maxRawBytes = 380_000,
): Promise<string | null> {
  const isPdf =
    file.type.toLowerCase() === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf || file.size > maxRawBytes) {
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      resolve(result && result.length <= 580_000 ? result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
