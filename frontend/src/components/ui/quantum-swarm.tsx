"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Physics & Geometry Types ---
interface SwarmParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseX: number;
    baseY: number;
    angle: number;       // Angle in the spiral
    distance: number;    // Distance from center
    size: number;
    excitation: number;  // Used for glow/color pulsing
}

interface PointerState {
    x: number;
    y: number;
    isDown: boolean;
    radius: number;
    shockwaves: Array<{ x: number; y: number; radius: number; maxRadius: number; strength: number }>;
}

export interface QuantumSwarmProps {
    headline?: string;
    tagline?: string;
    className?: string;
    particleCount?: number;
}

export function QuantumSwarm({
    headline = "QUANTUM",
    tagline = "SWARM DYNAMICS",
    className = "",
    particleCount = 280, // High enough for density, low enough to keep O(N^2) line drawing smooth
}: QuantumSwarmProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [isRunning, setIsRunning] = useState(true);

    // Pointer state tracking
    const pointerRef = useRef<PointerState>({
        x: -2000,
        y: -2000,
        isDown: false,
        radius: 150,
        shockwaves: [],
    });

    const particlesRef = useRef<SwarmParticle[]>([]);
    const dimensionsRef = useRef({ width: 0, height: 0, cx: 0, cy: 0 });

    // --------------------------------------------------------
    // MESH / SWARM INITIALIZATION
    // --------------------------------------------------------
    const buildSwarm = useCallback(() => {
        const { width, height, cx, cy } = dimensionsRef.current;
        if (width === 0 || height === 0) return;

        const particles: SwarmParticle[] = [];

        // Use the Golden Angle to create a beautiful, organic spiral distribution (like a sunflower)
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angleIncrement = Math.PI * 2 * goldenRatio;

        // Scale the galaxy to fit the screen
        const maxRadius = Math.max(width, height) * 0.45;

        for (let i = 0; i < particleCount; i++) {
            // Distribute particles with density focused slightly towards the center
            const dst = Math.pow(i / (particleCount - 1), 0.6) * maxRadius;
            const angle = i * angleIncrement;

            particles.push({
                x: cx + Math.cos(angle) * dst,
                y: cy + Math.sin(angle) * dst,
                vx: 0,
                vy: 0,
                baseX: 0, // Will be updated per frame to create rotation
                baseY: 0,
                angle: angle,
                distance: dst,
                size: Math.random() * 1.5 + 0.5,
                excitation: 0,
            });
        }

        particlesRef.current = particles;
    }, [particleCount]);

    // --------------------------------------------------------
    // CANVAS SIZING & RESIZE OBSERVER
    // --------------------------------------------------------
    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const rect = entry.contentRect;
                const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap DPR for performance

                dimensionsRef.current = {
                    width: rect.width,
                    height: rect.height,
                    cx: rect.width / 2,
                    cy: rect.height / 2
                };

                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;

                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                buildSwarm();
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [buildSwarm]);

    // --------------------------------------------------------
    // PHYSICS & RENDER LOOP
    // --------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        let animId = 0;
        let time = 0;

        const loop = () => {
            if (!isRunning) {
                animId = requestAnimationFrame(loop);
                return;
            }

            time += 0.002; // Global rotation speed
            const { width, height, cx, cy } = dimensionsRef.current;
            const particles = particlesRef.current;
            const pointer = pointerRef.current;

            const isDark =
                document.documentElement.classList.contains("dark") ||
                (typeof document !== 'undefined' && document.body?.classList.contains("dark")) ||
                (typeof window !== 'undefined' && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
            
            // In light theme: crisp slate background, dark navy / electric blue dots and connecting lines
            // In dark theme: rich deep space background (#070a0f), luminous cyan / white contrasting dots
            const bgColor = isDark ? "#070a0f" : "#f8fafc";
            const strokeBase = isDark ? "56, 189, 248" : "2, 132, 199"; // Cyan in dark, Tech Blue in light
            const particleBaseColor = isDark ? "#ffffff" : "#0f172a"; // Crisp white in dark, Deep Navy in light
            const excitedGlowColor = isDark ? "rgba(56, 189, 248, 0.8)" : "rgba(2, 132, 199, 0.8)";

            // 1. Draw Background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            // 2. Process Shockwaves (from clicks)
            for (let s = pointer.shockwaves.length - 1; s >= 0; s--) {
                const sw = pointer.shockwaves[s];
                sw.radius += 15;
                sw.strength *= 0.92;
                if (sw.radius > sw.maxRadius || sw.strength < 0.01) {
                    pointer.shockwaves.splice(s, 1);
                }
            }

            // 3. Physics Pass: Update Positions and Velocities
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                // Calculate current target position (slowly rotating the entire spiral)
                const currentAngle = p.angle + time * (1 + 100 / (p.distance + 100)); // Inner particles rotate slightly faster
                p.baseX = cx + Math.cos(currentAngle) * p.distance;
                p.baseY = cy + Math.sin(currentAngle) * p.distance;

                // --- Forces ---
                // a. Spring force towards their orbital base position
                const dxBase = p.baseX - p.x;
                const dyBase = p.baseY - p.y;
                p.vx += dxBase * 0.02; // Spring constant
                p.vy += dyBase * 0.02;

                // b. Pointer interaction (Repulsion / Mouse Magnet)
                const dxPointer = p.x - pointer.x;
                const dyPointer = p.y - pointer.y;
                const distPointer = Math.sqrt(dxPointer * dxPointer + dyPointer * dyPointer);

                if (distPointer < pointer.radius && distPointer > 0) {
                    // Repulse away from pointer
                    const force = (pointer.radius - distPointer) / pointer.radius;
                    // If mouse is down, pull them in slightly instead, creating a tension effect
                    const directionMultiplier = pointer.isDown ? -0.5 : 1.5;
                    p.vx += (dxPointer / distPointer) * force * directionMultiplier;
                    p.vy += (dyPointer / distPointer) * force * directionMultiplier;
                    p.excitation = Math.max(p.excitation, force);
                }

                // c. Shockwave force
                for (let s = 0; s < pointer.shockwaves.length; s++) {
                    const sw = pointer.shockwaves[s];
                    const dxSw = p.x - sw.x;
                    const dySw = p.y - sw.y;
                    const distSw = Math.sqrt(dxSw * dxSw + dySw * dySw);
                    const ringDelta = Math.abs(distSw - sw.radius);

                    if (ringDelta < 30) {
                        const impulse = (1 - ringDelta / 30) * sw.strength * 15;
                        p.vx += (dxSw / distSw) * impulse;
                        p.vy += (dySw / distSw) * impulse;
                        p.excitation = Math.max(p.excitation, 1.0);
                    }
                }

                // d. Apply velocity and friction
                p.vx *= 0.88; // Friction/damping
                p.vy *= 0.88;
                p.x += p.vx;
                p.y += p.vy;

                // e. Cool down excitation
                p.excitation *= 0.95;
            }

            // 4. Render Pass: Connections (Constellation lines)
            const connectionDistanceSq = 3600; // 60px * 60px
            ctx.lineWidth = 0.6;

            for (let i = 0; i < particles.length; i++) {
                const p1 = particles[i];

                // Draw lines to nearby particles
                // Optimization: Only check a limited set ahead to save CPU on O(N^2)
                const limit = Math.min(particles.length, i + 15);
                for (let j = i + 1; j < limit; j++) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < connectionDistanceSq) {
                        const dist = Math.sqrt(distSq);
                        const opacity = 1 - (dist / 60);

                        // If particles are excited, lines glow
                        const combinedExcitation = Math.max(p1.excitation, p2.excitation);
                        const dynamicAlpha = Math.min(1, (opacity * 0.2) + (combinedExcitation * 0.5));

                        ctx.strokeStyle = `rgba(${strokeBase}, ${dynamicAlpha})`;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }

            // 5. Render Pass: Particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                const radius = p.size + (p.excitation * 2.5);
                // When excited, turn particle bright electric cyan or deep blue
                ctx.fillStyle = p.excitation > 0.2 
                    ? (isDark ? "#38bdf8" : "#0284c7") 
                    : (i % 5 === 0 ? (isDark ? "#38bdf8" : "#2563eb") : particleBaseColor);

                // For highly excited particles, add an outer glow
                if (p.excitation > 0.2) {
                    ctx.save();
                    ctx.globalAlpha = p.excitation * 0.45;
                    ctx.fillStyle = excitedGlowColor;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, radius * 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }

            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, [isRunning]);

    // --------------------------------------------------------
    // EVENT HANDLERS
    // --------------------------------------------------------
    const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        pointerRef.current.x = e.clientX - rect.left;
        pointerRef.current.y = e.clientY - rect.top;
    };

    const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;

        pointerRef.current.isDown = true;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create a localized shockwave at pointer
        pointerRef.current.shockwaves.push({
            x, y,
            radius: 10,
            maxRadius: 200,
            strength: 0.8,
        });
    };

    const handlePointerUp = () => {
        pointerRef.current.isDown = false;
    };

    const handlePointerLeave = () => {
        // Move pointer far off screen so forces drop to zero
        pointerRef.current.x = -2000;
        pointerRef.current.y = -2000;
        pointerRef.current.isDown = false;
    };

    // Central explosive pulse feature
    const triggerSystemPulse = () => {
        const { cx, cy, width, height } = dimensionsRef.current;
        pointerRef.current.shockwaves.push({
            x: cx,
            y: cy,
            radius: 10,
            maxRadius: Math.max(width, height) * 0.8,
            strength: 1.5, // Stronger than a click shockwave
        });
    };

    return (
        <div
            ref={containerRef}
            onMouseMove={handlePointerMove}
            onMouseDown={handlePointerDown}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerLeave}
            className={cn(
                "group relative flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm transition-colors duration-700 dark:border-neutral-800 dark:bg-[#09090b]",
                className
            )}
        >
            {/* The active rendering canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 block h-full w-full cursor-crosshair"
            />

            {/* UI Overlay - only rendered if headline or tagline provided */}
            {(headline || tagline) ? (
                <div className="relative z-20 flex h-full w-full flex-col justify-between p-5 md:p-8 pointer-events-none">
                    {tagline ? (
                        <header className="flex w-full items-center justify-between font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                            <div className="flex items-center gap-3">
                                <span className="relative flex size-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-500 opacity-60" />
                                    <span className="relative inline-flex size-2 rounded-full bg-cyan-600 dark:bg-cyan-400" />
                                </span>
                                <span className="font-semibold tracking-wider text-neutral-800 uppercase dark:text-neutral-200">
                                    {tagline}
                                </span>
                            </div>
                        </header>
                    ) : null}

                    {headline ? (
                        <main className="flex flex-col items-center justify-center text-center opacity-95">
                            <h1 className="font-mono text-5xl font-black tracking-tighter uppercase sm:text-7xl md:text-8xl text-neutral-900 dark:text-white pointer-events-none drop-shadow-sm">
                                {headline}
                            </h1>
                        </main>
                    ) : null}
                    <div className="h-6 w-full" />
                </div>
            ) : null}
        </div>
    );
}

export default QuantumSwarm;

