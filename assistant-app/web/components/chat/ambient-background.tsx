"use client";

import { useEffect, useRef } from "react";

const GRID_SIZE = 112;

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let scale = 1;
    let frame = 0;
    let lastTime = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const columns = Math.ceil(width / GRID_SIZE) + 1;
      const rows = Math.ceil(height / GRID_SIZE) + 1;
      const points: { x: number; y: number }[] = [];

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          points.push({
            x: column * GRID_SIZE + Math.sin(time * 0.0002 + row * 0.72) * 13,
            y: row * GRID_SIZE + Math.cos(time * 0.00018 + column * 0.64) * 11,
          });
        }
      }

      const dark = document.documentElement.classList.contains("dark");
      context.strokeStyle = dark ? "rgba(92, 204, 170, 0.12)" : "rgba(20, 120, 94, 0.11)";
      context.fillStyle = dark ? "rgba(247, 151, 120, 0.34)" : "rgba(206, 91, 63, 0.25)";
      context.lineWidth = 0.7;

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const point = points[row * columns + column];
          context.beginPath();
          context.moveTo(point.x, point.y);
          if (column + 1 < columns) {
            const right = points[row * columns + column + 1];
            context.lineTo(right.x, right.y);
          }
          if (row + 1 < rows) {
            const below = points[(row + 1) * columns + column];
            context.moveTo(point.x, point.y);
            context.lineTo(below.x, below.y);
          }
          context.stroke();
          context.beginPath();
          context.arc(point.x, point.y, 1.1, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    const resize = () => {
      scale = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      draw(lastTime);
    };

    const animate = (time: number) => {
      if (time - lastTime >= 40) {
        lastTime = time;
        draw(time);
      }
      frame = window.requestAnimationFrame(animate);
    };

    const syncMotion = () => {
      window.cancelAnimationFrame(frame);
      draw(lastTime);
      if (!motionPreference.matches) frame = window.requestAnimationFrame(animate);
    };

    const themeObserver = new MutationObserver(() => draw(lastTime));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    motionPreference.addEventListener("change", syncMotion);
    window.addEventListener("resize", resize);
    resize();
    syncMotion();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      motionPreference.removeEventListener("change", syncMotion);
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 size-full" />;
}