import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, Move } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CONTAINER_SIZE = 280;
const OUTPUT_SIZE = 400;

export default function ImageCropperModal({ open, file, onClose, onCrop }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const imgElRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setImgSrc(null);
      setNaturalSize({ w: 0, h: 0 });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target.result);
    reader.readAsDataURL(file);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [open]);

  const handleImgLoad = (e) => {
    setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handlePointerUp = () => setIsDragging(false);

  const handleApply = async () => {
    if (!imgElRef.current || !naturalSize.w) return;
    const { w: iw, h: ih } = naturalSize;
    const coverScale = Math.max(CONTAINER_SIZE / iw, CONTAINER_SIZE / ih);
    const totalScale = coverScale * zoom;

    const srcX = iw / 2 - CONTAINER_SIZE / (2 * totalScale) - offset.x / totalScale;
    const srcY = ih / 2 - CONTAINER_SIZE / (2 * totalScale) - offset.y / totalScale;
    const srcSize = CONTAINER_SIZE / totalScale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(imgElRef.current, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        setUploading(true);
        const croppedFile = new File([blob], 'group-photo.jpg', { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: croppedFile });
        onCrop(file_url);
        onClose();
      } catch (err) {
        console.error('Erro ao enviar imagem recortada:', err);
      } finally {
        setUploading(false);
      }
    }, 'image/jpeg', 0.92);
  };

  const coverScale = naturalSize.w ? Math.max(CONTAINER_SIZE / naturalSize.w, CONTAINER_SIZE / naturalSize.h) : 1;
  const displayW = naturalSize.w * coverScale * zoom;
  const displayH = naturalSize.h * coverScale * zoom;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar foto do grupo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative rounded-full overflow-hidden bg-slate-100 cursor-move touch-none select-none ring-4 ring-violet-100"
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {imgSrc && (
              <img
                ref={imgElRef}
                src={imgSrc}
                onLoad={handleImgLoad}
                alt=""
                draggable={false}
                className="absolute top-1/2 left-1/2 pointer-events-none"
                style={{
                  width: displayW,
                  height: displayH,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            )}
            {!imgSrc && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-slate-300" />
              </div>
            )}
          </div>
          <div className="w-full flex items-center gap-3 px-2">
            <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <Slider value={[zoom]} onValueChange={(v) => setZoom(v[0])} min={1} max={3} step={0.01} className="flex-1" />
            <span className="text-xs text-slate-400 w-8 text-right">{zoom.toFixed(1)}x</span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Move className="w-3 h-3" />
            Arraste para posicionar a imagem
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleApply} disabled={uploading || !imgSrc} className="bg-violet-600 hover:bg-violet-700">
            {uploading ? 'Enviando...' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}