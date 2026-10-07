"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import axios from "axios";
import { 
  RiRobot2Fill, 
  RiUser3Line, 
  RiLayoutGridLine, 
  RiStarLine, 
  RiSearchLine, 
  RiArrowRightUpLine, 
  RiAddLine,
  RiInformationLine
} from "react-icons/ri";

const AgentCard = ({ agent, category }) => (
  <Link
    href={`/agents/${agent.agent_id}`}
    className="group flex flex-col bg-[#080808] border border-white/[0.08] rounded-xl p-2 hover:bg-white/[0.05] hover:border-white/20 transition-all duration-200 shadow-sm hover:shadow-md"
  >
    {/* Large Image Top (muapiapp style) */}
    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
      {agent.icon_url ? (
        <img
          src={agent.icon_url}
          alt={agent.name}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <RiRobot2Fill className="w-12 h-12 text-white/40" />
      )}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="p-1.5 bg-[#080808]/80 backdrop-blur-md rounded-lg border border-white/[0.08] shadow-sm">
          <RiArrowRightUpLine className="w-3.5 h-3.5 text-white/70" />
        </div>
      </div>
    </div>

    {/* Content Bottom */}
    <div className="px-2 pb-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-white truncate group-hover:text-white/70 transition-colors">
          {agent.name}
        </h3>
        <span className="text-[9px] font-black text-white/70 uppercase tracking-widest shrink-0">
           {category}
        </span>
      </div>

      <p className="text-[11px] text-white/55 line-clamp-2 leading-relaxed h-8 mb-4 font-medium">
        {agent.description || "Specialized AI Intelligence Unit for complex workflows."}
      </p>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-1.5">
          <span className="flex h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
          <span className="text-[9px] font-bold text-white/55 uppercase tracking-wider">Ready</span>
        </div>
        <div className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">
          ACTIVE HUB
        </div>
      </div>
    </div>
  </Link>
);

const CategorySection = ({ title, icon: Icon, agents, categoryLabel }) => {
  const items = Array.isArray(agents) ? agents : [];
  if (items.length === 0) return null;
  
  return (
    <section className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-6 border-l-2 border-white/30 pl-3">
        <Icon className="w-4 h-4 text-white/55" />
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        <span className="text-[10px] font-black text-white/55 bg-white/[0.04] px-1.5 py-0.5 rounded-md ml-1">{items.length}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map(a => (
          <AgentCard key={a.id || a.agent_id} agent={a} category={categoryLabel} />
        ))}
      </div>
    </section>
  );
};

export default function AgentsLibrary() {
  const [agents, setAgents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("workforce"); // Removed "all"

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const BASE_URL = "/api/agents";

      const [userRes, templatesRes, featuredRes] = await Promise.all([
        axios.get(`${BASE_URL}/user/agents`),
        axios.get(`${BASE_URL}/templates/agents`),
        axios.get(`${BASE_URL}/featured/agents`)
      ]);

      setAgents(Array.isArray(userRes.data) ? userRes.data : []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setFeatured(Array.isArray(featuredRes.data) ? featuredRes.data : []);
    } catch (err) {
      console.error(err);
      setError("Synchronizing failed. Check connectivity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const filterAgents = (list) => {
    const arr = Array.isArray(list) ? list : [];
    if (!searchTerm) return arr;
    return arr.filter(a => 
      (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const filteredAgents = filterAgents(agents);
  const filteredTemplates = filterAgents(templates);
  const filteredFeatured = filterAgents(featured);

  const TABS = [
    { id: "workforce", label: "My Workforce", icon: RiUser3Line },
    { id: "templates", label: "Templates", icon: RiLayoutGridLine },
    { id: "featured", label: "Featured", icon: RiStarLine },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/10 font-sans pb-20">
      <div className="fixed top-0 right-0 w-1/3 h-1/3 bg-white/[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed inset-0 bg-[#00000003] backdrop-noise pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-12">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-fade-in-up">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <RiRobot2Fill className="text-white/70 w-8 h-8" />
              Agent Library
            </h1>
            <p className="text-white/55 text-sm font-medium uppercase tracking-widest text-[10px]">Manage Intelligence Workflow</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
             <div className="relative min-w-[280px]">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                <input 
                  type="text"
                  placeholder="Filter intelligence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-[#e6e6e6] placeholder:text-[#a6a6a6] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition-colors font-medium"
                />
             </div>
             <Link 
               href="/agents/create"
               className="flex items-center justify-center gap-1.5 px-5 h-10 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors shrink-0"
             >
               <RiAddLine className="w-4 h-4" />
               Create
             </Link>
          </div>
        </header>

        {/* Tab Strip */}
        <nav className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl mb-12 w-fit animate-fade-in-up shadow-sm" style={{ animationDelay: '0.1s' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-[12px] font-bold rounded-xl transition-all ${
                activeTab === tab.id 
                  ? "bg-white/[0.08] text-white border border-white/[0.08]"
                  : "text-white/55 hover:text-white hover:bg-[#080808]/50"
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-white/70" : "text-white/55"}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-8 h-8 border-2 border-white/[0.08] border-t-white rounded-full animate-spin" />
            <p className="text-white/55 text-[10px] font-bold uppercase tracking-widest animate-pulse">Syncing Library...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 p-8 border border-white/[0.08] bg-[#080808] rounded-xl text-center max-w-md mx-auto shadow-sm">
             <RiInformationLine className="w-8 h-8 text-red-500/50 mb-4" />
             <h2 className="text-lg font-bold mb-1 text-white">Connection Error</h2>
             <p className="text-white/55 text-xs mb-6 leading-relaxed">{error}</p>
             <button 
               onClick={fetchAllData}
               className="px-6 h-10 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
             >
               Reconnect
             </button>
          </div>
        ) : (
          <div className="space-y-4">
            
            {activeTab === "workforce" && (
              <CategorySection 
                title="My Workforce"
                icon={RiUser3Line}
                agents={filteredAgents}
                categoryLabel="Personal"
              />
            )}

            {activeTab === "templates" && (
              <CategorySection 
                title="Templates"
                icon={RiLayoutGridLine}
                agents={filteredTemplates}
                categoryLabel="Blueprint"
              />
            )}

            {activeTab === "featured" && (
              <CategorySection 
                title="Featured"
                icon={RiStarLine}
                agents={filteredFeatured}
                categoryLabel="Verified"
              />
            )}

            {(activeTab === "workforce" ? filteredAgents : activeTab === "templates" ? filteredTemplates : filteredFeatured).length === 0 && (
              <div className="py-32 text-center bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
                <RiSearchLine className="w-10 h-10 text-white/40 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white/55 mb-1">No units found</h3>
                <p className="text-white/55 text-[10px] font-medium uppercase tracking-widest">Adjust filters or architect a new unit</p>
              </div>
            )}

          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .backdrop-noise {
          background-image: url('https://grainy-gradients.vercel.app/noise.svg');
          opacity: 0.01;
          filter: contrast(120%) brightness(120%);
        }
      `}</style>
    </div>
  );
}
