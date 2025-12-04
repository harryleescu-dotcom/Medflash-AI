
export const processInputFile = async (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    // 1. Handle PDFs (skip resizing)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        // Basic check for empty file
        if (!res || !res.includes(',')) {
             reject(new Error("File reading failed or empty file."));
             return;
        }
        resolve({ base64: res.split(',')[1], mimeType: 'application/pdf' });
      };
      reader.onerror = () => reject(new Error("Failed to read PDF file."));
      reader.readAsDataURL(file);
      return;
    }

    // 2. Handle Images (Resize & Normalize to JPEG)
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize if too large (Max 2500px)
        const MAX_SIZE = 2500; 
        if (width > MAX_SIZE || height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Canvas context failed"));
            return;
        }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          base64: dataUrl.split(',')[1],
          mimeType: 'image/jpeg'
        });
      };
      img.onerror = () => reject(new Error("Failed to load image data."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
};

export const cropAndAnnotateImage = async (
  cleanBase64: string,
  boundingBox: number[] | undefined, // Label Coordinates
  cleanPlateMimeType: string,
  cardIndex: number,
  structureBoundingBox?: number[] // Anatomy Coordinates (Optional)
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      const MAX_DIMENSION = 1200;
      let targetW = img.width;
      let targetH = img.height;

      if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / targetW, MAX_DIMENSION / targetH);
        targetW *= ratio;
        targetH *= ratio;
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      
      const getRect = (box: number[]) => {
        let [ymin, xmin, ymax, xmax] = box;
        if (ymin > 1) ymin /= 1000;
        if (xmin > 1) xmin /= 1000;
        if (ymax > 1) ymax /= 1000;
        if (xmax > 1) xmax /= 1000;
        
        const x = Math.floor(xmin * targetW);
        const y = Math.floor(ymin * targetH);
        const w = Math.ceil((xmax - xmin) * targetW);
        const h = Math.ceil((ymax - ymin) * targetH);
        return { x, y, w, h };
      };

      if (boundingBox) {
        const labelRect = getRect(boundingBox);
        const labelCenterX = labelRect.x + labelRect.w / 2;
        const labelCenterY = labelRect.y + labelRect.h / 2;
        
        // DRAW POINTER LINE/ARROW if structure coordinates are present
        if (structureBoundingBox) {
            const structRect = getRect(structureBoundingBox);
            const structCenterX = structRect.x + structRect.w / 2;
            const structCenterY = structRect.y + structRect.h / 2;

            ctx.save();
            ctx.strokeStyle = "#ef4444"; // Red
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(labelCenterX, labelCenterY);
            ctx.lineTo(structCenterX, structCenterY);
            ctx.stroke();

            // Draw a small dot at the structure end
            ctx.beginPath();
            ctx.arc(structCenterX, structCenterY, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "#ef4444";
            ctx.fill();
            ctx.restore();
        }

        // DRAW BADGE
        const badgeRadius = Math.max(20, Math.min(labelRect.w, labelRect.h) * 0.7); 

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.arc(labelCenterX, labelCenterY, badgeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444'; // Red-500
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.shadowColor = "transparent";
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${badgeRadius * 1.1}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cardIndex), labelCenterX, labelCenterY + (badgeRadius * 0.1));
        ctx.restore();
      }

      resolve(canvas.toDataURL(cleanPlateMimeType));
    };
    img.onerror = (e) => {
        console.error("Image load failed", e);
        reject(e);
    };
    img.src = `data:${cleanPlateMimeType};base64,${cleanBase64}`;
  });
};
