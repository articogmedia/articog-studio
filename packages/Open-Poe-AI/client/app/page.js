"use client";

import React from "react";
import Link from "next/link";
import { RiRobot2Fill, RiTeamLine, RiFlashlightLine, RiNodeTree } from "react-icons/ri";

export default function WelcomePage() {
  return (
    <div className="relative min-h-screen w-full bg-black text-white overflow-hidden selection:bg-white/10 font-sans">
      {/* Premium Background Effects */}
      <div className="fixed top-[-10%] right-[-5%] w-[50%] h-[50%] bg-white/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-white/[0.03] rounded-full blur-[120px] pointer-events-none" style={{ animationDelay: '2s' }} />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* Subtle Noise Texture */}
      <div className="fixed inset-0 opacity-[0.01] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] filter contrast(120%) brightness(120%)" />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 max-w-7xl mx-auto min-h-screen">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/10 rounded-full animate-fade-in-up">
          <span className="flex h-2 w-2 rounded-full bg-white/70 animate-pulse" />
          <span className="text-xs font-bold tracking-wide text-white/70 uppercase">Next Gen AI Engine</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-6xl md:text-8xl font-semibold text-center tracking-tight leading-[1.08] mb-8 text-white animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Vibe-Agents <br />
          <span className="text-white/70">Intelligent Workforce</span>
        </h1>

        {/* Description */}
        <p className="max-w-2xl text-center text-lg md:text-xl text-white/55 font-medium leading-relaxed mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Unleash autonomous AI agents that think, collaborate, and execute. 
          The ultimate platform for architecting specialized intelligence into your workflows.
        </p>

        {/* CTA Section */}
        <div className="flex flex-col sm:flex-row gap-4 items-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <Link 
            href="/agents"
            className="group relative px-8 py-4 bg-white text-black font-medium rounded-full transition-colors hover:bg-white/90 active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative flex items-center gap-2">
              Browse Agent Library
              <RiRobot2Fill className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </span>
          </Link>
          <Link 
            href="/agents/create"
            className="px-8 py-4 bg-white/[0.03] border border-white/10 text-white/70 font-medium rounded-full hover:bg-white/[0.05] hover:text-white transition-colors active:scale-[0.98]"
          >
            Architect New Agent
          </Link>
        </div>

        {/* Features Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="p-8 rounded-xl bg-white/[0.03] border border-white/[0.08] group hover:bg-white/[0.05] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mb-6">
              <RiTeamLine className="w-6 h-6 text-white/70" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Multi-Agent Teams</h3>
            <p className="text-white/55 leading-relaxed font-medium">Build swarms of specialized agents that collaborate on complex tasks through natural language.</p>
          </div>

          <div className="p-8 rounded-xl bg-white/[0.03] border border-white/[0.08] group hover:bg-white/[0.05] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mb-6">
              <RiFlashlightLine className="w-6 h-6 text-white/70" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Instant Execution</h3>
            <p className="text-white/55 leading-relaxed font-medium">From code generation to visual design, agents execute with unprecedented speed and accuracy.</p>
          </div>

          <div className="p-8 rounded-xl bg-white/[0.03] border border-white/[0.08] group hover:bg-white/[0.05] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#080808]/[0.05] flex items-center justify-center mb-6">
              <RiNodeTree className="w-6 h-6 text-white/70" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Modular Logic</h3>
            <p className="text-white/55 leading-relaxed font-medium">Deeply integrated with Vibe-Workflow for seamless bridging between human intent and automated logic.</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
