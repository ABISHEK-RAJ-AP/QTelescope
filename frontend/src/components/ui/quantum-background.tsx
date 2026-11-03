"use client";

import React, { useEffect, useRef } from "react";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseX: number;
    baseY: number;
    size: number;
    color: string;
    alpha: number;
}

export interface QuantumBackgroundProps {
    className?: string;
}

export function QuantumBackground({ className = "" }: QuantumBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;

        let animId = 0;
        let width = 0;
        let height = 0;

        const pointer = {
            x: -2000,
            y: -2000,
            radius: 170,
            isDown: false,
        };

        const particles: Particle[] = [];

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        };

        const initParticles = () => {
            particles.length = 0;
            // Scale particle density with screen area: generous density for 14" laptop up to 4K
            const targetCount = Math.max(300, Math.min(500, Math.floor((width * height) / 4000)));

            for (let i = 0; i < targetCount; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                particles.push({
                    x,
                    y,
                    vx: (Math.random() - 0.5) * 0.45,
                    vy: (Math.random() - 0.5) * 0.45,
                    baseX: x,
                    baseY: y,
                    size: Math.random() * 2.2 + 1.2,
                    color: i % 4 === 0 ? "cyan" : (i % 3 === 0 ? "blue" : (i % 5 === 0 ? "accent" : "base")),
                    alpha: Math.random() * 0.5 + 0.4,
                });
            }
        };

        resize();
        initParticles();

        const onResize = () => {
            resize();
            initParticles();
        };

        const onMouseMove = (e: MouseEvent) => {
            pointer.x = e.clientX;
            pointer.y = e.clientY;
        };

        const onMouseLeave = () => {
            pointer.x = -2000;
            pointer.y = -2000;
        };

        window.addEventListener("resize", onResize);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseleave", onMouseLeave);

        const loop = () => {
            ctx.clearRect(0, 0, width, height);

            const isDark = document.documentElement.classList.contains("dark");

            // Connection line color:
            // Light theme: crisp tech blue/cyan
            // Dark theme: luminous electric cyan
            const strokeColor = isDark ? "rgba(56, 189, 248, " : "rgba(2, 132, 199, ";

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                p.x += p.vx;
                p.y += p.vy;

                // Bounce smoothly off viewport edges
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                // Mouse interactivity: gentle elastic repulsion
                const dx = p.x - pointer.x;
                const dy = p.y - pointer.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < pointer.radius && dist > 0) {
                    const force = (pointer.radius - dist) / pointer.radius;
                    p.x += (dx / dist) * force * 3.5;
                    p.y += (dy / dist) * force * 3.5;
                }

                // Particle color based on theme
                let fillColor = isDark ? "#ffffff" : "#0f172a";
                if (p.color === "cyan") {
                    fillColor = isDark ? "#38bdf8" : "#0284c7";
                } else if (p.color === "blue") {
                    fillColor = isDark ? "#60a5fa" : "#2563eb";
                } else if (p.color === "accent") {
                    fillColor = isDark ? "#2dd4bf" : "#0369a1";
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = fillColor;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
                ctx.globalAlpha = 1;

                // Constellation connections to neighboring dots
                const checkLimit = Math.min(particles.length, i + 14);
                for (let j = i + 1; j < checkLimit; j++) {
                    const p2 = particles[j];
                    const distSq = (p.x - p2.x) ** 2 + (p.y - p2.y) ** 2;
                    if (distSq < 15500) { // ~124px
                        const lineDist = Math.sqrt(distSq);
                        const alpha = (1 - lineDist / 124) * (isDark ? 0.38 : 0.28);
                        ctx.strokeStyle = strokeColor + alpha + ")";
                        ctx.lineWidth = 0.85;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }

            animId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseleave", onMouseLeave);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`pointer-events-none fixed inset-0 z-0 h-full w-full ${className}`}
            aria-hidden="true"
        />
    );
}

export default QuantumBackground;
