import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Factory,
  GitBranch,
  Database,
  Network,
  User,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const navItems = [
  {
    path: "/agent",
    icon: Bot,
    labelKey: "nav.agent",
    gradient: "from-emerald-300 via-emerald-400 to-teal-500",
    glow: "group-hover:shadow-emerald-400/25",
    descKey: "agent.description",
  },
  {
    path: "/factory",
    icon: Factory,
    labelKey: "nav.factory",
    gradient: "from-amber-300 via-amber-400 to-orange-500",
    glow: "group-hover:shadow-amber-400/25",
    descKey: "factory.description",
  },
  {
    path: "/workflow",
    icon: GitBranch,
    labelKey: "nav.workflow",
    gradient: "from-sky-300 via-blue-400 to-indigo-500",
    glow: "group-hover:shadow-blue-400/25",
    descKey: "workflow.description",
  },
  {
    path: "/swarm",
    icon: Network,
    labelKey: "nav.swarm",
    gradient: "from-teal-300 via-teal-400 to-cyan-500",
    glow: "group-hover:shadow-teal-400/25",
    descKey: "swarm.description",
  },
  {
    path: "/data",
    icon: Database,
    labelKey: "nav.data",
    gradient: "from-violet-300 via-violet-400 to-purple-500",
    glow: "group-hover:shadow-violet-400/25",
    descKey: "data.description",
  },
  {
    path: "/profile",
    icon: User,
    labelKey: "nav.profile",
    gradient: "from-gray-400 via-gray-500 to-slate-500",
    glow: "group-hover:shadow-gray-400/20",
    descKey: "profile.description",
  },
] as const;

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Gradient orbs */}
      <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-300/12 to-transparent blur-3xl" />
      <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-300/15 via-emerald-300/10 to-transparent blur-3xl" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-b from-primary/10 to-transparent blur-3xl animate-pulse-soft" />

      {/* Neural network SVG pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08] dark:opacity-[0.12]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="fadeMask">
            <rect width="100%" height="100%" fill="url(#fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#fadeMask)" />
      </svg>

      {/* Floating nodes & connections */}
      <svg
        className="absolute inset-0 w-full h-full text-primary"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1200 800"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Connection lines */}
        <g
          className="opacity-[0.15] dark:opacity-[0.22]"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        >
          <line x1="180" y1="120" x2="420" y2="200">
            <animate
              attributeName="opacity"
              values="0.3;0.8;0.3"
              dur="4s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="420" y1="200" x2="700" y2="160">
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="3.5s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="700" y1="160" x2="950" y2="280">
            <animate
              attributeName="opacity"
              values="0.4;0.9;0.4"
              dur="5s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="420" y1="200" x2="350" y2="450">
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="700" y1="160" x2="780" y2="420">
            <animate
              attributeName="opacity"
              values="0.5;0.8;0.5"
              dur="3s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="350" y1="450" x2="600" y2="550">
            <animate
              attributeName="opacity"
              values="0.4;0.9;0.4"
              dur="4s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="780" y1="420" x2="600" y2="550">
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="3.8s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="600" y1="550" x2="500" y2="700">
            <animate
              attributeName="opacity"
              values="0.5;0.8;0.5"
              dur="4.2s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="950" y1="280" x2="1050" y2="500">
            <animate
              attributeName="opacity"
              values="0.3;0.6;0.3"
              dur="5.5s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="180" y1="120" x2="100" y2="350">
            <animate
              attributeName="opacity"
              values="0.4;0.8;0.4"
              dur="4.8s"
              repeatCount="indefinite"
            />
          </line>
          <line x1="100" y1="350" x2="350" y2="450">
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="3.6s"
              repeatCount="indefinite"
            />
          </line>
        </g>

        {/* Nodes */}
        <g className="opacity-[0.2] dark:opacity-[0.3]">
          {[
            { cx: 180, cy: 120, r: 4, delay: "0s" },
            { cx: 420, cy: 200, r: 5, delay: "0.5s" },
            { cx: 700, cy: 160, r: 4.5, delay: "1s" },
            { cx: 950, cy: 280, r: 3.5, delay: "1.5s" },
            { cx: 350, cy: 450, r: 4, delay: "0.8s" },
            { cx: 780, cy: 420, r: 5, delay: "0.3s" },
            { cx: 600, cy: 550, r: 6, delay: "1.2s" },
            { cx: 100, cy: 350, r: 3, delay: "0.6s" },
            { cx: 500, cy: 700, r: 4, delay: "1.8s" },
            { cx: 1050, cy: 500, r: 3.5, delay: "0.9s" },
          ].map((node, i) => (
            <g key={i}>
              <circle cx={node.cx} cy={node.cy} r={node.r * 4} fill="url(#nodeGlow)" />
              <circle cx={node.cx} cy={node.cy} r={node.r} fill="currentColor">
                <animate
                  attributeName="r"
                  values={`${node.r};${node.r * 1.5};${node.r}`}
                  dur="3s"
                  begin={node.delay}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="3s"
                  begin={node.delay}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>

        {/* Traveling data packets along connections */}
        <g className="opacity-[0.25] dark:opacity-[0.35]" fill="currentColor">
          <circle r="2">
            <animateMotion dur="3s" repeatCount="indefinite" path="M180,120 L420,200" />
          </circle>
          <circle r="1.5">
            <animateMotion dur="2.5s" repeatCount="indefinite" path="M420,200 L700,160" />
          </circle>
          <circle r="2">
            <animateMotion dur="4s" repeatCount="indefinite" path="M700,160 L780,420" />
          </circle>
          <circle r="1.5">
            <animateMotion dur="3.5s" repeatCount="indefinite" path="M350,450 L600,550" />
          </circle>
          <circle r="2">
            <animateMotion dur="3s" repeatCount="indefinite" path="M100,350 L350,450" />
          </circle>
        </g>
      </svg>

      {/* Hexagon accent pattern (top-right) */}
      <svg
        className="absolute -top-10 -right-10 w-[320px] h-[320px] opacity-[0.07] dark:opacity-[0.1]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 300 300"
      >
        <g fill="none" stroke="currentColor" strokeWidth="0.8" className="text-primary">
          {[
            { x: 150, y: 80, s: 40 },
            { x: 100, y: 150, s: 35 },
            { x: 200, y: 150, s: 35 },
            { x: 150, y: 220, s: 40 },
            { x: 60, y: 80, s: 28 },
            { x: 240, y: 80, s: 28 },
          ].map((h, i) => {
            const pts = Array.from({ length: 6 }, (_, k) => {
              const angle = (Math.PI / 3) * k - Math.PI / 6;
              return `${h.x + h.s * Math.cos(angle)},${h.y + h.s * Math.sin(angle)}`;
            }).join(" ");
            return <polygon key={i} points={pts} />;
          })}
        </g>
      </svg>

      {/* Bottom-left circuit traces */}
      <svg
        className="absolute -bottom-8 -left-8 w-[280px] h-[280px] opacity-[0.08] dark:opacity-[0.12]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 260 260"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-primary"
          strokeLinecap="round"
        >
          <path d="M20,240 L20,160 L80,160 L80,100 L140,100" />
          <path d="M60,240 L60,200 L120,200 L120,140 L180,140" />
          <path d="M100,240 L100,220 L160,220 L160,180 L220,180" />
          <circle cx="140" cy="100" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="180" cy="140" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="220" cy="180" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="80" cy="160" r="2" fill="currentColor" opacity="0.3" />
          <circle cx="120" cy="200" r="2" fill="currentColor" opacity="0.3" />
          <circle cx="160" cy="220" r="2" fill="currentColor" opacity="0.3" />
        </g>
      </svg>
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-10 relative overflow-hidden">
      <HeroBackground />

      <div className="max-w-5xl w-full space-y-10 relative z-10">
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-medium text-muted-foreground mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI Agent Framework
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground">Mozi</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {t("app.description")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {navItems.map(({ path, icon: Icon, labelKey, gradient, glow, descKey }, i) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`group relative flex flex-col items-start gap-4 p-5 md:p-6 rounded-2xl glass premium-shadow transition-all duration-300 hover:-translate-y-1 ${glow} hover:shadow-lg text-left animate-fade-in-up stagger-${i + 1}`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-300" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold text-foreground">{t(labelKey)}</span>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {t(descKey, "")}
                </p>
              </div>
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
