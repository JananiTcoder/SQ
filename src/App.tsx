import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { AnimatePresence, motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import {
  Activity,
  AlertTriangle,
  Bot,
  Camera,
  ChevronRight,
  ClipboardList,
  Droplets,
  Gauge,
  Home,
  Layers3,
  LocateFixed,
  LogIn,
  KeyRound,
  MapPin,
  Menu,
  MessageSquareWarning,
  Navigation,
  QrCode,
  Radar,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThermometerSun,
  TicketCheck,
  Users,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { sanitiqApi } from "./api/sanitiqApi";
import { heatmapCells, mockComplaints, mockSummary, mockToilets, mockWardRisk, riskTrend } from "./data/sanitiqMock";
import type { Availability, Cleanliness, Complaint, ComplaintStatus, LoginRole, Priority, Restroom, RiskPrediction, SummaryMetrics, WardRisk } from "./types/sanitiq";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Toilets", href: "/toilets", icon: ShieldCheck },
  { label: "Map", href: "/map", icon: MapPin },
  { label: "AI Risk", href: "/outbreak", icon: Radar },
  { label: "Complaints", href: "/complaints", icon: ClipboardList },
  { label: "Tokens", href: "/tokens", icon: TicketCheck },
];

const mobileNavItems = navItems.filter((item) => ["Home", "Dashboard", "Toilets", "Map", "Complaints", "Tokens"].includes(item.label));
const commandNavItems = [
  { label: "Overview", href: "/dashboard", icon: Gauge },
  { label: "Tickets", href: "/staff/complaints", icon: ClipboardList },
  { label: "Toilets", href: "/toilets", icon: ShieldCheck },
  { label: "Sensors", href: "/sensors", icon: Activity },
  { label: "Map", href: "/map", icon: MapPin },
  { label: "Workers", href: "/workers", icon: Users },
  { label: "AI Risk", href: "/outbreak", icon: Radar },
  { label: "Reports", href: "/reports", icon: TicketCheck },
  { label: "Settings", href: "/settings", icon: SlidersHorizontal },
];

const hygieneColors: Record<Cleanliness, string> = {
  Clean: "bg-emerald-400 text-emerald-950",
  Moderate: "bg-amber-400 text-amber-950",
  Dirty: "bg-rose-500 text-white",
};

const riskColors: Record<string, string> = {
  Low: "text-emerald-300 bg-emerald-400/10 border-emerald-300/25",
  Medium: "text-amber-200 bg-amber-400/10 border-amber-300/25",
  High: "text-orange-200 bg-orange-400/10 border-orange-300/25",
  Critical: "text-rose-200 bg-rose-500/10 border-rose-300/25",
};

const priorityColors: Record<Priority, string> = {
  Low: "bg-cyan-400/15 text-cyan-200 border-cyan-300/25",
  Medium: "bg-amber-400/15 text-amber-200 border-amber-300/25",
  High: "bg-orange-400/15 text-orange-200 border-orange-300/25",
  Critical: "bg-rose-500/15 text-rose-200 border-rose-300/25",
};

const statusColors: Record<ComplaintStatus, string> = {
  Pending: "bg-amber-400/15 text-amber-200 border-amber-300/25",
  "In Progress": "bg-cyan-400/15 text-cyan-200 border-cyan-300/25",
  Resolved: "bg-emerald-400/15 text-emerald-200 border-emerald-300/25",
};

const inputClassName = "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50";
const staffHomeByRole: Record<LoginRole, string> = {
  admin: "/staff/complaints",
  worker: "/staff/complaints",
  public: "/public",
};

interface StaffSession {
  role: "admin" | "worker";
  email: string;
  source: "backend" | "demo";
  loggedInAt: string;
}

const demoStaffCredentials: Record<LoginRole, { email: string; password: string }> = {
  admin: { email: "admin@sanitiq.gov", password: "sanitiq-demo" },
  worker: { email: "worker@sanitiq.gov", password: "worker-demo" },
  public: { email: "public@sanitizeai.app", password: "public-demo" },
};

function isDemoStaffCredential(role: LoginRole, email: string, password: string) {
  const credential = demoStaffCredentials[role];
  return email.trim().toLowerCase() === credential.email && password === credential.password;
}

function getStaffSession(): StaffSession | null {
  try {
    const raw = window.sessionStorage.getItem("sanitiq:staff-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffSession;
    return parsed.role === "admin" || parsed.role === "worker" ? parsed : null;
  } catch {
    return null;
  }
}

function useSanitiQData() {
  const [summary, setSummary] = useState<SummaryMetrics>(mockSummary);
  const [toilets, setToilets] = useState<Restroom[]>(mockToilets);
  const [complaints, setComplaints] = useState<Complaint[]>(mockComplaints);
  const [wardRisk, setWardRisk] = useState<WardRisk[]>(mockWardRisk);
  const [isLive, setIsLive] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [summaryResult, toiletsResult, complaintsResult, riskResult] = await Promise.allSettled([
        sanitiqApi.summary(),
        sanitiqApi.toilets(),
        sanitiqApi.complaints(),
        sanitiqApi.wardRisk(),
      ]);

      if (!mounted) return;

      let connected = false;
      if (summaryResult.status === "fulfilled" && summaryResult.value) {
        setSummary(summaryResult.value);
        connected = true;
      }
      if (toiletsResult.status === "fulfilled" && Array.isArray(toiletsResult.value) && toiletsResult.value.length > 0) {
        setToilets(toiletsResult.value);
        connected = true;
      }
      if (complaintsResult.status === "fulfilled" && Array.isArray(complaintsResult.value)) {
        setComplaints(complaintsResult.value);
        connected = true;
      }
      if (riskResult.status === "fulfilled" && Array.isArray(riskResult.value) && riskResult.value.length > 0) {
        setWardRisk(riskResult.value);
        connected = true;
      }
      setIsLive(connected);
      setLastSync(new Date());
    };

    void load();
    const refresh = window.setInterval(() => void load(), 30000);

    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, []);

  const addComplaint = async (payload: Omit<Complaint, "id" | "createdAt" | "status">) => {
    const fallback: Complaint = {
      ...payload,
      id: `C-${Math.floor(9000 + Math.random() * 900)}`,
      createdAt: "Just now",
      status: "Pending",
    };

    try {
      const created = await sanitiqApi.addComplaint(payload);
      setComplaints((items) => [created, ...items]);
    } catch {
      setComplaints((items) => [fallback, ...items]);
    }
  };

  const updateComplaintStatus = async (id: string, status: ComplaintStatus) => {
    setComplaints((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
    try {
      await sanitiqApi.updateComplaintStatus(id, status);
    } catch {
      setIsLive(false);
    }
  };

  return { summary, toilets, complaints, wardRisk, isLive, lastSync, addComplaint, updateComplaintStatus };
}

function AppShell({ children, isLive, lastSync }: { children: ReactNode; isLive: boolean; lastSync: Date }) {
  const location = useLocation();
  const isCommandPage = location.pathname !== "/" && location.pathname !== "/login";

  return (
    <div className="min-h-screen overflow-hidden bg-[#06111f] text-slate-50">
      <SiteNav isLive={isLive} lastSync={lastSync} />
      {isCommandPage ? <CommandFrame>{children}</CommandFrame> : children}
      <MobileNav />
    </div>
  );
}

function SiteNav({ isLive, lastSync }: { isLive: boolean; lastSync: Date }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-[900] border-b border-cyan-300/10 bg-[#06111f]/78 backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="SanitizeAI home">
          <BrandMark />
          <div>
            <p className="text-lg font-black tracking-tight text-white">SanitizeAI</p>
            <p className="hidden text-[11px] uppercase tracking-[0.28em] text-cyan-200/70 sm:block">Smart Restrooms</p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems
            .filter((item) => {
              const role = getStaffSession()?.role;
              if (item.label === "Complaints" && role === "worker") return false;
              if (item.label === "Tokens" && role !== "worker") return false;
              return true;
            })
            .map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-300"}`} />
            {isLive ? "Backend live" : "Demo data"}
          </div>
          <Link to="/login" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
            Staff Login
          </Link>
        </div>

        <button className="rounded-full border border-white/10 p-2 text-white lg:hidden" onClick={() => setOpen((value) => !value)} aria-label="Open navigation">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-4 mb-4 rounded-3xl border border-cyan-300/10 bg-slate-950/95 p-3 shadow-2xl lg:hidden"
          >
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-200 hover:bg-white/10">
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            <div className="mt-2 rounded-2xl bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">Last sync {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function CommandFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl gap-5 px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-10">
      <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-64 shrink-0 rounded-[2rem] border border-cyan-300/10 bg-slate-950/55 p-4 backdrop-blur-2xl lg:block">
        <div className="mb-6 rounded-[1.5rem] bg-cyan-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Command Center</p>
          <p className="mt-2 text-xl font-bold text-white">Municipal AI Ops</p>
        </div>
        <div className="space-y-1">
          {commandNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-4 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <Activity size={17} /> Live sensor mesh
          </div>
          <p className="mt-2 text-xs leading-5 text-emerald-50/70">Auto-refresh enabled. WebSocket handoff ready for backend upgrade.</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function MobileNav() {
  const [session, setSession] = useState<StaffSession | null>(() => getStaffSession());

  useEffect(() => {
    const handler = () => setSession(getStaffSession());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);


  const role = session?.role;
  const visibleNavItems = mobileNavItems.filter((item) => {
    if (item.label === "Complaints" && role === "worker") return false;
    if (item.label === "Tokens" && role !== "worker") return false;
    return true;
  });

  const colCount = visibleNavItems.length;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[900] rounded-full border border-cyan-300/20 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-full py-2 text-[10px] font-semibold transition ${isActive ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`
            }
          >
            <item.icon size={16} />
            {item.label.split(" ")[0]}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function HomePage({ summary, toilets }: { summary: SummaryMetrics; toilets: Restroom[] }) {
  const nearest = toilets.slice(0, 3);

  return (
    <div className="bg-[#06111f]">
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <HeroVisual />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <Sparkles size={16} /> AI-powered civic sanitation platform
            </div>
            <h1 className="text-6xl font-black tracking-[-0.08em] text-white sm:text-7xl lg:text-8xl">SanitizeAI</h1>
            <p className="mt-5 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-cyan-100 sm:text-5xl">Smart restroom monitoring for cleaner, safer cities.</p>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              Connect IoT sensors, complaint workflows, AI risk prediction, and city-wide restroom maps in one real-time command interface.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-300">
                Open dashboard <ChevronRight size={18} />
              </Link>
              <Link to="/complaints" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/10">
                Scan restroom QR <QrCode size={18} />
              </Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }} className="hidden lg:block">
            <CityConsoleIllustration />
          </motion.div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Live civic view" title="Public hygiene status at a glance" subtitle="Mock data is shown until your Flask APIs respond, then the widgets swap to live backend values automatically." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={ShieldCheck} label="Restrooms monitored" value={summary.totalRestrooms.toString()} tone="cyan" />
          <StatTile icon={Activity} label="Active sensors" value={summary.activeSensors.toString()} tone="emerald" />
          <StatTile icon={Gauge} label="Avg hygiene score" value={`${summary.averageHygieneScore}%`} tone="cyan" />
          <StatTile icon={Siren} label="Open alerts" value={summary.sensorAlerts.toString()} tone="rose" />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeading eyebrow="Citizen app" title="Find clean facilities near you" subtitle="Search, scan QR codes, check hygiene badges, and submit issues without calling a helpline." />
          <div className="mt-8 space-y-3">
            {nearest.map((toilet) => (
              <motion.div key={toilet.id} whileHover={{ x: 6 }} className="light-glass rounded-[1.75rem] p-4 text-slate-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">{toilet.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{toilet.area} · {toilet.lastCleaned}</p>
                  </div>
                  <HygieneBadge cleanliness={toilet.cleanliness} score={toilet.hygieneScore} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="min-h-[440px] overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/60 p-2 shadow-2xl shadow-cyan-950/30">
          <SanitiQMap toilets={toilets} showHeat />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="System workflow" title="From sensor event to maintenance response" subtitle="SanitizeAI converts restroom telemetry into decisions that city teams can act on immediately." />
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {[
            { icon: Waves, title: "IoT Sensors", text: "Odor, humidity, occupancy, ammonia, and usage telemetry." },
            { icon: Bot, title: "AI Prediction", text: "Risk scoring detects cleanliness drops and outbreak zones early." },
            { icon: TicketCheck, title: "Civic Tickets", text: "QR and app complaints become trackable maintenance tasks." },
            { icon: Navigation, title: "Crew Dispatch", text: "Priority routing sends the right team to the right ward." },
          ].map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="glass-panel rounded-[2rem] p-6"
            >
              <item.icon className="text-cyan-300" size={30} />
              <h3 className="mt-5 text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function DashboardPage({ summary, toilets, complaints, wardRisk, isLive, lastSync }: { summary: SummaryMetrics; toilets: Restroom[]; complaints: Complaint[]; wardRisk: WardRisk[]; isLive: boolean; lastSync: Date }) {
  const cleanlinessCounts = useMemo(() => countCleanliness(toilets), [toilets]);
  const criticalToilets = toilets.filter((toilet) => toilet.hygieneScore < 65 || toilet.cleanliness === "Dirty");

  return (
    <div className="space-y-6">
      <CommandHeader title="Overview" subtitle="Real-time restroom metrics, AI cleanliness prediction, and maintenance alerts." isLive={isLive} lastSync={lastSync} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShieldCheck} label="Total Public Toilets" value={summary.totalRestrooms} suffix="" detail={`${toilets.length} visible in current view`} trend="+12 this quarter" />
        <MetricCard icon={Activity} label="Active Sensors" value={summary.activeSensors} suffix="" detail="Odor, humidity, occupancy" trend="98.2% uptime" />
        <MetricCard icon={MessageSquareWarning} label="Pending Complaints" value={summary.pendingComplaints} suffix="" detail={`${complaints.filter((item) => item.status !== "Resolved").length} tickets loaded`} trend="-8% today" />
        <MetricCard icon={Bot} label="AI Risk Score" value={summary.aiRiskScore} suffix="/100" detail="City-wide outbreak index" trend="Stable" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Risk and usage trend" action="Auto-refresh 30s">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hygiene" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="risk" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="hygiene" stroke="#22c55e" fill="url(#hygiene)" strokeWidth={3} />
                <Area type="monotone" dataKey="risk" stroke="#ef4444" fill="url(#risk)" strokeWidth={3} />
                <Line type="monotone" dataKey="usage" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Hygiene status" action="Live classes">
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <StatusMeter label="Clean" value={cleanlinessCounts.Clean} total={toilets.length} color="bg-emerald-400" />
            <StatusMeter label="Moderate" value={cleanlinessCounts.Moderate} total={toilets.length} color="bg-amber-400" />
            <StatusMeter label="Dirty" value={cleanlinessCounts.Dirty} total={toilets.length} color="bg-rose-500" />
          </div>
          <div className="mt-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData(cleanlinessCounts)} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={5}>
                  {pieData(cleanlinessCounts).map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Maintenance alerts" action={`${criticalToilets.length} priority zones`}>
          <div className="space-y-3">
            {criticalToilets.slice(0, 4).map((toilet) => (
              <AlertRow key={toilet.id} toilet={toilet} />
            ))}
          </div>
        </Panel>
        <Panel title="Ward hygiene comparison" action="ML ranking">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardRisk} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="ward" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="riskScore" radius={[10, 10, 0, 0]} fill="#06b6d4" />
                <Bar dataKey="forecast" radius={[10, 10, 0, 0]} fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Usage heatmap" action="35 sensor windows">
        <UsageHeatmap />
      </Panel>
    </div>
  );
}

function ToiletsPage({ toilets }: { toilets: Restroom[] }) {
  const [query, setQuery] = useState("");
  const [cleanliness, setCleanliness] = useState<Cleanliness | "All">("All");
  const [availability, setAvailability] = useState<Availability | "All">("All");
  const [ward, setWard] = useState("All");
  const [selected, setSelected] = useState<Restroom | null>(null);
  const wards = useMemo(() => Array.from(new Set(toilets.map((toilet) => toilet.ward))), [toilets]);
  const filtered = useMemo(
    () =>
      toilets.filter((toilet) => {
        const matchesSearch = `${toilet.name} ${toilet.area} ${toilet.ward}`.toLowerCase().includes(query.toLowerCase());
        return matchesSearch && (cleanliness === "All" || toilet.cleanliness === cleanliness) && (availability === "All" || toilet.availability === availability) && (ward === "All" || toilet.ward === ward);
      }),
    [availability, cleanliness, query, toilets, ward],
  );

  return (
    <div className="space-y-6">
      <CommandHeader title="Smart Restroom List" subtitle="Search facilities, filter by risk, and inspect live sensor values." isLive lastSync={new Date()} />
      <Panel title="Filters" action={`${filtered.length} results`}>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_160px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search toilet, ward, area" className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50" />
          </label>
          <Select value={cleanliness} onChange={(value) => setCleanliness(value as Cleanliness | "All")} options={["All", "Clean", "Moderate", "Dirty"]} />
          <Select value={availability} onChange={(value) => setAvailability(value as Availability | "All")} options={["All", "Available", "Occupied", "Maintenance"]} />
          <Select value={ward} onChange={setWard} options={["All", ...wards]} />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((toilet) => (
          <ToiletCard key={toilet.id} toilet={toilet} onOpen={setSelected} />
        ))}
      </div>
      <AnimatePresence>{selected ? <ToiletModal toilet={selected} onClose={() => setSelected(null)} /> : null}</AnimatePresence>
    </div>
  );
}

function MapPage({ toilets }: { toilets: Restroom[] }) {
  return (
    <div className="space-y-6">
      <CommandHeader title="Interactive Map View" subtitle="OpenStreetMap markers are color-coded by cleanliness and ready for GPS nearby lookup." isLive lastSync={new Date()} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="h-[72vh] min-h-[560px] overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/60 p-2 shadow-2xl">
          <SanitiQMap toilets={toilets} showHeat />
        </div>
        <div className="space-y-4">
          <Panel title="Map controls" action="GPS ready">
            <div className="space-y-3">
              <ActionLine icon={LocateFixed} title="Nearby locator" text="Use browser geolocation in production to center the nearest restroom." />
              <ActionLine icon={Layers3} title="Risk heat layer" text="Cyan circles indicate live restroom coverage and risk concentration." />
              <ActionLine icon={SlidersHorizontal} title="Cleanliness markers" text="Green, amber, and red markers follow AI hygiene classification." />
            </div>
          </Panel>
          <Panel title="Critical map list" action="Sorted by score">
            <div className="space-y-3">
              {[...toilets].sort((a, b) => a.hygieneScore - b.hygieneScore).slice(0, 4).map((toilet) => (
                <div key={toilet.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{toilet.name}</p>
                    <HygieneBadge cleanliness={toilet.cleanliness} score={toilet.hygieneScore} />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{toilet.ward} · {toilet.area}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PublicPortalPage({ summary, toilets, wardRisk }: { summary: SummaryMetrics; toilets: Restroom[]; wardRisk: WardRisk[] }) {
  const topRestrooms = [...toilets].sort((a, b) => b.hygieneScore - a.hygieneScore).slice(0, 4);

  return (
    <div className="space-y-6">
      <CommandHeader title="Public Restroom View" subtitle="A simplified read-only SanitizeAI dashboard for cleanliness, nearby availability, ratings, and AI hygiene indicators." isLive lastSync={new Date()} />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={ShieldCheck} label="Total Toilets" value={summary.totalRestrooms} suffix="" detail="City restroom network" trend="Public" />
        <MetricCard icon={Gauge} label="Avg Hygiene" value={summary.averageHygieneScore} suffix="%" detail="AI cleanliness score" trend="Read-only" />
        <MetricCard icon={Activity} label="Active Sensors" value={summary.activeSensors} suffix="" detail="Humidity and gas sensors" trend="Live" />
        <MetricCard icon={Siren} label="Alerts Today" value={summary.sensorAlerts} suffix="" detail="Maintenance visibility" trend="Public" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Panel title="Nearby restrooms" action="Cleanliness ranked">
          <div className="space-y-3">
            {topRestrooms.map((toilet) => (
              <div key={toilet.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-white">{toilet.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{toilet.area} · {toilet.availability} · Rating {toilet.rating}/5</p>
                  </div>
                  <HygieneBadge cleanliness={toilet.cleanliness} score={toilet.hygieneScore} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Public map analytics" action="OpenStreetMap">
          <div className="h-[420px] overflow-hidden rounded-[1.5rem]">
            <SanitiQMap toilets={toilets} showHeat />
          </div>
        </Panel>
      </div>
      <Panel title="AI hygiene indicators" action="Read-only">
        <div className="grid gap-3 md:grid-cols-3">
          {wardRisk.slice(0, 3).map((ward) => (
            <div key={ward.ward} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-white">{ward.ward}</p>
                <Badge className={riskColors[ward.level]}>{ward.level}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-400">Risk score {ward.riskScore}% · Forecast {ward.forecast}%</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AdminControlsPanel() {
  const [autoclean, setAutoclean] = useState(false);
  const [callWorker, setCallWorker] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="text-sm font-semibold text-white">Auto Clean Toilet</span>
        <button
          type="button"
          onClick={() => setAutoclean((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${autoclean ? "bg-cyan-400" : "bg-white/20"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${autoclean ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="text-sm font-semibold text-white">Call Worker</span>
        <button
          type="button"
          onClick={() => setCallWorker((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${callWorker ? "bg-cyan-400" : "bg-white/20"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${callWorker ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/70">Worker Contact</p>
        <p className="mt-1 text-sm font-bold text-white">+91 84287 67747</p>
      </div>
    </div>
  );
}

function QrComplaintIntake({ toilets, onAdd }: { toilets: Restroom[]; onAdd: (payload: Omit<Complaint, "id" | "createdAt" | "status">) => Promise<void> }) {
  const scannerElementId = "sanitiq-complaint-qr-reader";
  const [selectedId, setSelectedId] = useState(toilets[0]?.id ?? "");
  const [manualCode, setManualCode] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanMessage, setScanMessage] = useState("Scan any QR code to view restroom readings and open the complaint box.");
  const [category, setCategory] = useState("Bad Odor");
  const [ratings, setRatings] = useState({ cleanliness: 4, smell: 3, water: 4, overall: 4 });
  const [issue, setIssue] = useState("");
  const [imageName, setImageName] = useState("");
  const [sent, setSent] = useState(false);
  const [riskPrediction, setRiskPrediction] = useState<RiskPrediction | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const complaintBoxRef = useRef<HTMLDivElement | null>(null);
  const staticSensorData = { humidity: 67, gas: 23, hygieneScore: 84, hygieneLevel: "Good" };
  const feedbacks = [
    { name: "Public user", text: "Clean floor and good lighting near the entrance.", rating: 4 },
    { name: "Morning commuter", text: "Soap was available, but odor should be checked by staff.", rating: 3 },
    { name: "Ward volunteer", text: "QR reporting is simple and the facility was usable.", rating: 5 },
  ];

  const selectedToilet = toilets.find((toilet) => toilet.id === selectedId) ?? toilets[0];

  const fallbackRiskPrediction = (toilet: Restroom | undefined): RiskPrediction => {
    const hygieneScore = toilet?.hygieneScore ?? staticSensorData.hygieneScore;
    const odorLevel = toilet?.odorLevel ?? 42;
    const riskLevel = hygieneScore < 50 ? "Critical" : hygieneScore < 65 || odorLevel > 65 ? "High" : hygieneScore < 80 ? "Moderate" : "Low";
    return {
      riskLevel,
      confidence: riskLevel === "Low" ? 86 : riskLevel === "Moderate" ? 89 : riskLevel === "High" ? 92 : 96,
      severity: riskLevel === "Low" ? "Stable" : riskLevel === "Moderate" ? "Watch" : riskLevel === "High" ? "Elevated" : "Severe",
      maintenanceUrgency: riskLevel === "Low" ? "Routine" : riskLevel === "Moderate" ? "Next cleaning cycle" : riskLevel === "High" ? "Priority dispatch" : "Immediate",
      drivers: ["Humidity sensor", "Gas sensor", "Odor level", "Cleaning delay", "Complaint frequency"],
    };
  };

  const stopScanner = async () => {
    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch {
        // The scanner can already be stopped during StrictMode cleanup or after a successful scan.
      }
    }
    setScannerActive(false);
  };

  const openComplaintBox = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setScanMessage("Enter or scan any valid QR payload first.");
      return false;
    }

    const resolvedId = resolveQrToToiletId(trimmed, toilets);
    const matchedToilet = resolvedId ? toilets.find((toilet) => toilet.id === resolvedId) : selectedToilet;
    if (resolvedId) setSelectedId(resolvedId);
    setScannedCode(trimmed);
    setScanComplete(true);
    setRiskPrediction(fallbackRiskPrediction(matchedToilet));
    setScanMessage(resolvedId ? `QR scanned and matched ${resolvedId}. Public readings and complaint box opened.` : "QR scanned. Public readings and complaint box opened.");
    if (resolvedId) {
      sanitiqApi.riskPrediction(resolvedId).then((prediction) => setRiskPrediction(prediction)).catch(() => undefined);
    }
    void stopScanner();
    window.setTimeout(() => complaintBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return true;
  };

  const startScanner = async () => {
    if (qrScannerRef.current) return;

    const reader = document.getElementById(scannerElementId);
    if (!reader) {
      setScanMessage("QR reader is still loading. Try again in a moment.");
      return;
    }

    try {
      const scanner = new Html5Qrcode(scannerElementId, { verbose: false });
      qrScannerRef.current = scanner;
      setScannerActive(true);
      setScanMessage("Camera scanner active. Point it at any QR code.");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => openComplaintBox(decodedText),
        () => undefined,
      );
    } catch {
      setScanMessage("Camera could not start. Allow camera permission or paste any QR payload below.");
      await stopScanner();
    }
  };

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  const submitPublicComplaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedToilet || !scanComplete) return;
    const priority: Priority = staticSensorData.hygieneScore < 55 ? "Critical" : staticSensorData.hygieneScore < 70 ? "High" : "Medium";
    await onAdd({
      toiletId: selectedToilet.id,
      toiletName: selectedToilet.name,
      ward: selectedToilet.ward,
      reporter: "Public QR User",
      issue: category,
      description: `QR payload: ${scannedCode}. Category: ${category}. Static public readings: humidity ${staticSensorData.humidity}%, gas ${staticSensorData.gas} ppm, hygiene level ${staticSensorData.hygieneLevel}, hygiene score ${staticSensorData.hygieneScore}%. Ratings: cleanliness ${ratings.cleanliness}/5, smell ${ratings.smell}/5, water ${ratings.water}/5, overall ${ratings.overall}/5. ${issue || "No extra description provided."}`,
      priority,
      imageName: imageName || undefined,
      assignedTo: "Unassigned",
    });
    setIssue("");
    setImageName("");
    setSent(true);
    window.setTimeout(() => setSent(false), 2500);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Scan QR code" action="Required before complaint">
        <div className="relative min-h-[340px] overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-slate-950">
          <div id={scannerElementId} className={`min-h-[340px] ${scannerActive ? "block" : "hidden"}`} />
          {!scannerActive ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }} className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                <Camera size={44} />
              </motion.div>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">Open camera scanning or paste any QR value. Once a QR is scanned, SanitizeAI reveals readings, feedbacks, and the complaint box.</p>
            </div>
          ) : null}
          {scannerActive ? <motion.div animate={{ y: [0, 270, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="absolute left-6 right-6 top-8 h-1 rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.95)]" /> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => void startScanner()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300">
            <Camera size={18} /> Start camera scan
          </button>
          <button type="button" onClick={() => void stopScanner()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/10">
            Stop scanner
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Paste any QR code payload" className={inputClassName} />
          <button type="button" onClick={() => openComplaintBox(manualCode)} className="rounded-2xl border border-cyan-300/25 px-5 py-3 font-bold text-cyan-100 transition hover:bg-cyan-300/10">Use QR</button>
        </div>
        <p className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-slate-300">{scanMessage}</p>
      </Panel>

      {getStaffSession()?.role === "admin" && (
        <Panel title="Admin Controls" action="Admin only">
          <AdminControlsPanel />
        </Panel>
      )}

      <div ref={complaintBoxRef} className="space-y-5">
        <div className="light-glass rounded-[2rem] p-5 text-slate-950">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.26em] text-teal-700">Static public sensor data</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{scanComplete ? "Complaint box ready" : "Scan QR to continue"}</h2>
              <p className="mt-2 text-sm text-slate-600">{scanComplete ? `Scanned QR: ${scannedCode}` : "The complaint form unlocks after any QR scan."}</p>
            </div>
            <Badge className={scanComplete ? "border-emerald-300/30 bg-emerald-400/20 text-emerald-900" : "border-amber-300/50 bg-amber-300/20 text-amber-900"}>{scanComplete ? "Scanned" : "Waiting"}</Badge>
          </div>

          {scanComplete ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PublicSensorTile icon={Droplets} label="Humidity" value={`${staticSensorData.humidity}%`} helper="Static public reading" />
              <PublicSensorTile icon={Activity} label="Gas sensor" value={`${staticSensorData.gas} ppm`} helper="Static gas sensor value" />
              <PublicSensorTile icon={ShieldCheck} label="Hygiene score" value={`${staticSensorData.hygieneScore}%`} helper="Static public score" />
              <PublicSensorTile icon={Sparkles} label="Hygiene level" value={staticSensorData.hygieneLevel} helper="Safe for public use" />
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-teal-300/50 bg-teal-50/70 p-5 text-sm font-semibold text-teal-900">
              Sensor data is hidden until a QR scan is completed.
            </div>
          )}
        </div>

        {scanComplete ? (
          <Panel title="Public feedbacks" action={`${feedbacks.length} recent`}>
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div key={feedback.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-white">{feedback.name}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-200"><Star size={15} fill="currentColor" /> {feedback.rating}/5</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{feedback.text}</p>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="Complaint box" action={scanComplete ? "QR verified" : "Locked"}>
          {!scanComplete ? (
            <div className="rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/5 p-6 text-center text-sm leading-6 text-cyan-100">
              Scan or paste any QR code first. The complaint fields will appear here immediately after scanning.
            </div>
          ) : (
            <form onSubmit={submitPublicComplaint} className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                Complaint will be linked to {selectedToilet?.name ?? "the nearest public restroom"}. Matched restroom IDs are detected automatically when the QR includes values like T-101.
              </div>
              <Select value={category} onChange={setCategory} options={["Bad Odor", "Dirty Floor", "Water Leakage", "No Water Supply", "Low Supplies", "Broken Equipment", "Overflow Issue", "Hygiene Concern"]} />
              <textarea value={issue} onChange={(event) => setIssue(event.target.value)} rows={5} placeholder="Describe the issue" className={`${inputClassName} resize-none`} />
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-300/5 px-4 py-4 text-sm text-cyan-100">
                <span>{imageName || "Upload optional image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => setImageName(event.target.files?.[0]?.name ?? "")} />
                <Camera size={18} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <StarRating label="Cleanliness" value={ratings.cleanliness} onChange={(value) => setRatings((current) => ({ ...current, cleanliness: value }))} />
                <StarRating label="Smell" value={ratings.smell} onChange={(value) => setRatings((current) => ({ ...current, smell: value }))} />
                <StarRating label="Water Availability" value={ratings.water} onChange={(value) => setRatings((current) => ({ ...current, water: value }))} />
                <StarRating label="Overall Experience" value={ratings.overall} onChange={(value) => setRatings((current) => ({ ...current, overall: value }))} />
              </div>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300">
                <Send size={18} /> Submit complaint
              </button>
              {sent ? <p className="rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-200">Complaint submitted with QR and static sensor data.</p> : null}
            </form>
          )}
        </Panel>

        {scanComplete && riskPrediction ? <RiskPredictionPanel prediction={riskPrediction} /> : null}
      </div>
    </div>
  );
}

function ComplaintsPage({ toilets, onAdd }: { toilets: Restroom[]; onAdd: (payload: Omit<Complaint, "id" | "createdAt" | "status">) => Promise<void> }) {
  return (
    <div className="space-y-6">
      <CommandHeader title="Public QR Complaint Intake" subtitle="Public users scan a restroom QR first, then SanitizeAI opens live-style readings, feedbacks, ratings, complaints, and AI risk prediction." isLive lastSync={new Date()} />
      <QrComplaintIntake toilets={toilets} onAdd={onAdd} />
    </div>
  );
}

function StarRating({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="mb-3 text-sm font-semibold text-slate-200">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" onClick={() => onChange(score)} className={`rounded-xl border p-2 transition ${score <= value ? "border-amber-300/40 bg-amber-300/20 text-amber-100" : "border-white/10 bg-white/[0.04] text-slate-400"}`} aria-label={`${label} ${score} stars`}>
            <Star size={17} fill={score <= value ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskPredictionPanel({ prediction }: { prediction: RiskPrediction }) {
  return (
    <Panel title="AI/ML Risk Prediction" action="Backend ML ready">
      <div className="grid gap-4 md:grid-cols-2">
        <div className={`rounded-[1.5rem] border p-5 ${riskPredictionClass(prediction.riskLevel)}`}>
          <p className="text-xs font-black uppercase tracking-[0.28em] opacity-75">Predicted Risk Level</p>
          <p className="mt-3 text-4xl font-black tracking-tight">{prediction.riskLevel}</p>
          <p className="mt-3 text-sm leading-6 opacity-80">Maintenance Required: {prediction.maintenanceUrgency}</p>
        </div>
        <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/75">AI Confidence Score</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-white">{prediction.confidence}%</p>
          <p className="mt-3 text-sm leading-6 text-cyan-100/80">Hygiene Severity Indicator: {prediction.severity}</p>
        </div>
      </div>
      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-bold text-white">Prediction drivers</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {prediction.drivers.map((driver) => (
            <Badge key={driver} className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">{driver}</Badge>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function StaffComplaintsPage({ complaints, onStatus }: { complaints: Complaint[]; onStatus: (id: string, status: ComplaintStatus) => Promise<void> }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<StaffSession | null>(() => getStaffSession());
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All">("All");
  const [assignments, setAssignments] = useState<Record<string, string>>(() => Object.fromEntries(complaints.map((complaint) => [complaint.id, complaint.assignedTo ?? "Unassigned"])));

  const filteredComplaints = useMemo(
    () =>
      complaints.filter((complaint) => {
        const matchesStatus = statusFilter === "All" || complaint.status === statusFilter;
        const matchesPriority = priorityFilter === "All" || complaint.priority === priorityFilter;
        return matchesStatus && matchesPriority;
      }),
    [complaints, priorityFilter, statusFilter],
  );

  const logout = () => {
    window.sessionStorage.removeItem("sanitiq:staff-session");
    setSession(null);
    navigate("/login");
  };

  if (!session) {
    return (
      <div className="space-y-6">
        <CommandHeader title="Staff Complaint Queue" subtitle="Admin and worker access is required to view and update public complaint tickets." isLive={false} lastSync={new Date()} />
        <Panel title="Login required" action="Protected">
          <div className="flex flex-col gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xl font-black text-white">Sign in as Admin or Worker</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Public complaint QR intake remains on /complaints. Staff can review and update tickets here after login.</p>
            </div>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300">
              <LogIn size={18} /> Staff login
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const openTickets = complaints.filter((complaint) => complaint.status !== "Resolved").length;
  const resolvedTickets = complaints.filter((complaint) => complaint.status === "Resolved").length;
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <CommandHeader
        title="Staff Complaint Queue"
        subtitle="Review public restroom complaints from QR users and update every ticket as Pending, In Progress, or Resolved. Admins can also see worker details."
        isLive
        lastSync={new Date()}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={ClipboardList} label="Total Complaints" value={complaints.length} suffix="" detail={`Signed in as ${session.role}`} trend={session.source} />
        <MetricCard icon={Siren} label="Open Tickets" value={openTickets} suffix="" detail="Pending and in-progress" trend="Needs action" />
        <MetricCard icon={TicketCheck} label="Resolved" value={resolvedTickets} suffix="" detail="Completed maintenance tickets" trend="Closed" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel title="Complaints raised by public users" action={`${filteredComplaints.length} visible`}>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <Select value={statusFilter} onChange={(value) => setStatusFilter(value as ComplaintStatus | "All")} options={["All", "Pending", "In Progress", "Resolved"]} />
            <Select value={priorityFilter} onChange={(value) => setPriorityFilter(value as Priority | "All")} options={["All", "Low", "Medium", "High", "Critical"]} />
          </div>

          <div className="space-y-3">
            {filteredComplaints.map((complaint) => (
              <StaffComplaintTicket
                key={complaint.id}
                complaint={complaint}
                isAdmin={isAdmin}
                assignedTo={assignments[complaint.id] ?? complaint.assignedTo ?? "Unassigned"}
                onAssign={(worker) => setAssignments((current) => ({ ...current, [complaint.id]: worker }))}
                onStatus={onStatus}
              />
            ))}
            {!filteredComplaints.length ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">No complaints match the current filters.</p> : null}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Access scope" action={isAdmin ? "Admin" : "Worker"}>
            <div className="space-y-3 text-sm leading-6 text-slate-300">
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">{isAdmin ? "Admin can monitor complaints, update status, and view worker assignment details." : "Worker can monitor complaints and update status, but worker roster details are hidden."}</p>
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">Logged in as {session.email}</p>
              <button onClick={logout} className="w-full rounded-2xl border border-white/10 px-4 py-3 font-bold text-white transition hover:bg-white/10">Logout</button>
            </div>
          </Panel>

          {isAdmin ? <WorkerDetailsPanel /> : <WorkerProfilePanel />}
        </div>
      </div>
    </div>
  );
}

function StaffComplaintTicket({ complaint, isAdmin, assignedTo, onAssign, onStatus }: { complaint: Complaint; isAdmin: boolean; assignedTo: string; onAssign: (worker: string) => void; onStatus: (id: string, status: ComplaintStatus) => Promise<void> }) {
  const [note, setNote] = useState("");

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-white">{complaint.issue}</p>
            <Badge className={priorityColors[complaint.priority]}>{complaint.priority}</Badge>
            <Badge className={statusColors[complaint.status]}>{complaint.status}</Badge>
          </div>
          <p className="mt-2 text-sm font-semibold text-cyan-100">{complaint.toiletName}</p>
          <p className="mt-1 text-xs text-slate-500">{complaint.id} · {complaint.ward} · {complaint.createdAt} · Reporter: {complaint.reporter}</p>
          <p className="mt-2 text-xs font-semibold text-slate-400">Assigned to: {assignedTo}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{complaint.description}</p>
          {complaint.imageName ? <p className="mt-2 text-xs text-slate-500">Attachment: {complaint.imageName}</p> : null}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Add maintenance note" className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50" />
        </div>
        <div className="w-full shrink-0 space-y-3 lg:w-48">
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Update status</label>
          <select value={complaint.status} onChange={(event) => void onStatus(complaint.id, event.target.value as ComplaintStatus)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50">
            <option>Pending</option>
            <option>In Progress</option>
            <option>Resolved</option>
          </select>
          {isAdmin ? (
            <>
              <label className="block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Assign worker</label>
              <select value={assignedTo} onChange={(event) => onAssign(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/50">
                <option>Unassigned</option>
                <option>Crew Alpha</option>
                <option>Crew Delta</option>
                <option>Crew Metro</option>
              </select>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkerDetailsPanel() {
  const workers = [
    { name: "Crew Alpha", zone: "Ward 19", tickets: 5, status: "On route" },
    { name: "Crew Delta", zone: "Ward 08", tickets: 2, status: "Cleaning" },
    { name: "Crew Metro", zone: "Ward 03", tickets: 3, status: "Available" },
  ];

  return (
    <Panel title="Worker details" action="Admin only">
      <div className="space-y-3">
        {workers.map((worker) => (
          <div key={worker.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-white">{worker.name}</p>
              <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">{worker.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-400">{worker.zone} · {worker.tickets} assigned tickets</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WorkerProfilePanel() {
  return (
    <Panel title="Worker profile" action="Self only">
      <div className="space-y-3 text-sm leading-6 text-slate-300">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="font-bold text-white">Aarav Patel · WRK-2048</p>
          <p className="mt-1 text-slate-400">Shift: 08:00-16:00 · Contact: +91 90000 2048</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SensorMini label="Assigned" value="7" />
          <SensorMini label="Completed" value="23" />
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
          Worker accounts can update complaints and cleaning progress, but cannot access all worker management details.
        </div>
      </div>
    </Panel>
  );
}

function SensorsPage({ toilets }: { toilets: Restroom[] }) {
  return (
    <div className="space-y-6">
      <CommandHeader title="Sensor Monitoring" subtitle="Live-style IoT telemetry for humidity, gas, odor, occupancy, and ammonia sensors." isLive lastSync={new Date()} />
      <div className="grid gap-4 md:grid-cols-3">
        {toilets.slice(0, 6).map((toilet) => (
          <Panel key={toilet.id} title={toilet.name} action={toilet.sensorOnline ? "Online" : "Check"}>
            <div className="grid grid-cols-2 gap-3">
              <SensorMini label="Humidity" value={`${toilet.humidity}%`} />
              <SensorMini label="Gas" value={`${toilet.ammonia} ppm`} />
              <SensorMini label="Odor" value={`${toilet.odorLevel}%`} />
              <SensorMini label="Occupancy" value={`${toilet.occupancy}%`} />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function WorkersPage() {
  const session = getStaffSession();
  return (
    <div className="space-y-6">
      <CommandHeader title="Worker Management" subtitle="Admin-only worker roster, assignment visibility, and performance monitoring." isLive={Boolean(session)} lastSync={new Date()} />
      {session?.role === "admin" ? <WorkerDetailsPanel /> : <WorkerRestrictedPanel />}
    </div>
  );
}

function WorkerRestrictedPanel() {
  return (
    <Panel title="Worker management" action="Admin only">
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-100">
        This area is restricted. Workers can view their own profile and update tasks in the complaint queue, but cannot access full worker management.
      </div>
    </Panel>
  );
}

function ReportsPage({ summary }: { summary: SummaryMetrics }) {
  return (
    <div className="space-y-6">
      <CommandHeader title="Reports" subtitle="Government-grade sanitation performance, cleaning efficiency, response time, and alert summaries." isLive lastSync={new Date()} />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={ShieldCheck} label="Cleaning Efficiency" value={summary.cleaningEfficiency} suffix="%" detail="Monthly operational report" trend="Report" />
        <MetricCard icon={Gauge} label="AI Risk Score" value={summary.aiRiskScore} suffix="/100" detail="ML summary index" trend="AI" />
        <MetricCard icon={Siren} label="Sensor Alerts" value={summary.sensorAlerts} suffix="" detail="Alert log export ready" trend="Alerts" />
        <MetricCard icon={RefreshCcw} label="Response Time" value={summary.responseTimeMinutes} suffix="m" detail="Average maintenance response" trend="SLA" />
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <CommandHeader title="Settings" subtitle="System configuration surface for API status, role access, alert thresholds, and notification preferences." isLive lastSync={new Date()} />
      <Panel title="Configuration" action="Demo safe">
        <div className="grid gap-3 md:grid-cols-3">
          <ActionLine icon={ShieldCheck} title="Role access" text="Admin, worker, and public user flows are separated by login role." />
          <ActionLine icon={Activity} title="Sensor thresholds" text="Humidity, gas, odor, and occupancy limits are ready for backend configuration." />
          <ActionLine icon={Bot} title="ML endpoints" text="Risk prediction integrates with /api/risk-prediction/:id and /api/ward-risk." />
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsPage({ wardRisk, toilets, complaints }: { wardRisk: WardRisk[]; toilets: Restroom[]; complaints: Complaint[] }) {
  const riskDistribution = [
    { name: "Low", value: wardRisk.filter((ward) => ward.level === "Low").length, color: "#22c55e" },
    { name: "Medium", value: wardRisk.filter((ward) => ward.level === "Medium").length, color: "#f59e0b" },
    { name: "High", value: wardRisk.filter((ward) => ward.level === "High").length, color: "#fb923c" },
    { name: "Critical", value: wardRisk.filter((ward) => ward.level === "Critical").length, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <CommandHeader title="AI Risk Analytics" subtitle="ML-based ward prediction, outbreak monitoring, and hygiene forecasting." isLive lastSync={new Date()} />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Radar} label="Critical Wards" value={wardRisk.filter((ward) => ward.level === "Critical").length} suffix="" detail="Require escalation" trend="ML confidence 91%" />
        <MetricCard icon={ThermometerSun} label="Avg Odor Level" value={Math.round(toilets.reduce((sum, item) => sum + item.odorLevel, 0) / toilets.length)} suffix="%" detail="Odor sensor index" trend="+3 in market areas" />
        <MetricCard icon={ClipboardList} label="Complaint Signals" value={complaints.length} suffix="" detail="Used for severity detection" trend="NLP ready" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Ward risk ranking" action="Forecast overlay">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardRisk} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="ward" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="riskScore" radius={[10, 10, 0, 0]} fill="#06b6d4" />
                <Bar dataKey="forecast" radius={[10, 10, 0, 0]} fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Risk distribution" action="Outbreak bands">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={104} paddingAngle={5}>
                  {riskDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Critical alert zones" action="Maintenance priority">
          <div className="space-y-3">
            {wardRisk.map((ward) => (
              <div key={ward.ward} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{ward.ward}</p>
                    <p className="mt-1 text-sm text-slate-400">{ward.toilets} toilets · {ward.complaints} complaints</p>
                  </div>
                  <Badge className={riskColors[ward.level]}>{ward.level}</Badge>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${ward.riskScore}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Hygiene forecasting" action="Next 24 hours">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="hygiene" stroke="#22c55e" strokeWidth={3} dot={{ fill: "#22c55e", r: 4 }} />
                <Line type="monotone" dataKey="complaints" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={3} dot={{ fill: "#ef4444", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<LoginRole>("admin");
  const [email, setEmail] = useState("admin@sanitiq.gov");
  const [password, setPassword] = useState("sanitiq-demo");
  const [message, setMessage] = useState("Choose Admin, Worker, or Public User login. The selected role is posted to /api/login.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectRole = (nextRole: LoginRole) => {
    setRole(nextRole);
    setEmail(demoStaffCredentials[nextRole].email);
    setPassword(demoStaffCredentials[nextRole].password);
    setMessage(
      nextRole === "admin"
        ? "Admin login opens dashboards, AI analytics, ticket controls, and worker details."
        : nextRole === "worker"
          ? "Worker login opens monitoring, complaints, and task updates without worker management."
          : "Public login opens a simplified read-only restroom dashboard.",
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage("Enter both email and password before logging in.");
      return;
    }

    const finishLogin = (source: "backend" | "demo") => {
      const destination = staffHomeByRole[role];
      window.sessionStorage.setItem(
        "sanitiq:staff-session",
        JSON.stringify({ role, email: email.trim(), source, loggedInAt: new Date().toISOString() }),
      );
      setMessage(`${role === "admin" ? "Admin" : role === "worker" ? "Worker" : "Public User"} login successful via ${source}. Redirecting to ${destination}.`);
      window.setTimeout(() => navigate(destination), 450);
    };

    setIsSubmitting(true);
    try {
      await sanitiqApi.login(email, password, role);
      finishLogin("backend");
    } catch {
      if (isDemoStaffCredential(role, email, password)) {
        finishLogin("demo");
      } else {
        const demo = demoStaffCredentials[role];
        setMessage(`Login failed. For demo mode use ${demo.email} with password ${demo.password}.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 pt-16">
      <HeroVisual />
      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="glass-panel relative z-10 w-full max-w-lg rounded-[2rem] p-6">
        <BrandMark />
        <h1 className="mt-6 text-3xl font-black text-white">Staff Login</h1>
        <p className="mt-2 text-sm text-slate-300">Separate access for admins, sanitation workers, and public users.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {([
            { value: "admin", label: "Admin", text: "Dashboards and analytics", icon: ShieldCheck },
            { value: "worker", label: "Worker", text: "Crew task access", icon: Users },
            { value: "public", label: "Public", text: "Read-only restroom view", icon: Home },
          ] as Array<{ value: LoginRole; label: string; text: string; icon: LucideIcon }>).map((item) => (
            <button key={item.value} type="button" onClick={() => selectRole(item.value)} className={`rounded-2xl border p-4 text-left transition ${role === item.value ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}>
              <item.icon size={22} />
              <p className="mt-3 font-black">{item.label}</p>
              <p className="mt-1 text-xs opacity-75">{item.text}</p>
            </button>
          ))}
        </div>

        <label className="mt-6 block text-sm font-semibold text-slate-200">Email</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
        <label className="mt-4 block text-sm font-semibold text-slate-200">Password</label>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
        <button disabled={isSubmitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
          <KeyRound size={18} /> {isSubmitting ? "Signing in..." : `Login as ${role === "admin" ? "Admin" : role === "worker" ? "Worker" : "Public User"}`}
        </button>
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 sm:grid-cols-2">
          <span className="inline-flex items-center gap-2"><LogIn size={16} /> Payload role: {role}</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Opens: {staffHomeByRole[role]}</span>
        </div>
        <p className="mt-3 rounded-2xl bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">
          Demo {role} credentials: {demoStaffCredentials[role].email} / {demoStaffCredentials[role].password}
        </p>
        <p className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-slate-300">{message}</p>
      </motion.form>
    </main>
  );
}

function ToiletCard({ toilet, onOpen }: { toilet: Restroom; onOpen: (toilet: Restroom) => void }) {
  return (
    <motion.button whileHover={{ y: -4 }} onClick={() => onOpen(toilet)} className="glass-panel group rounded-[2rem] p-5 text-left transition hover:border-cyan-300/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-white">{toilet.name}</p>
          <p className="mt-1 text-sm text-slate-400">{toilet.ward} · {toilet.area}</p>
        </div>
        <span className={`mt-1 h-3 w-3 rounded-full ${toilet.sensorOnline ? "bg-emerald-400" : "bg-amber-300"}`} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <HygieneBadge cleanliness={toilet.cleanliness} score={toilet.hygieneScore} />
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">{toilet.availability}</Badge>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <SensorMini label="Odor" value={`${toilet.odorLevel}%`} />
        <SensorMini label="Humidity" value={`${toilet.humidity}%`} />
        <SensorMini label="Occupancy" value={`${toilet.occupancy}%`} />
      </div>
      <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
        <span>Cleaned {toilet.lastCleaned}</span>
        <span className="text-cyan-200">{toilet.aiPrediction}</span>
      </div>
    </motion.button>
  );
}

function ToiletModal({ toilet, onClose }: { toilet: Restroom; onClose: () => void }) {
  const session = getStaffSession();
  const isWorker = session?.role === "worker";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[950] flex items-end bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="glass-panel w-full max-w-2xl rounded-[2rem] p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-black text-white">{toilet.name}</p>
            <p className="mt-2 text-sm text-slate-400">{toilet.ward} · {toilet.area} · {toilet.id}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white"><X size={18} /></button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SensorDetail icon={ShieldCheck} label="Cleanliness score" value={`${toilet.hygieneScore}%`} />
          <SensorDetail icon={Waves} label="Odor level" value={`${toilet.odorLevel}%`} />
          <SensorDetail icon={Droplets} label="Humidity" value={`${toilet.humidity}%`} />
          <SensorDetail icon={Users} label="Occupancy" value={`${toilet.occupancy}%`} />
          <SensorDetail icon={Activity} label="Ammonia index" value={`${toilet.ammonia} ppm`} />
          <SensorDetail icon={RefreshCcw} label="Last cleaned" value={toilet.lastCleaned} />
        </div>
        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
          <p className="text-sm font-bold text-cyan-100">AI Prediction</p>
          <p className="mt-2 text-slate-200">{toilet.aiPrediction}. Maintenance response target is {toilet.responseTime} with a public rating of {toilet.rating}/5.</p>
        </div>
        {isWorker && (
          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 flex flex-col items-center">
            <p className="text-sm font-bold text-emerald-100 mb-3">Worker Action: Restroom QR Code (Printable)</p>
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG value={toilet.id} size={150} level="H" />
            </div>
            <p className="mt-3 text-xs text-emerald-200 text-center">Place this QR code at the restroom entrance. Public users can scan it to view readings and log complaints.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function SanitiQMap({ toilets, showHeat = false }: { toilets: Restroom[]; showHeat?: boolean }) {
  const center: [number, number] = [19.076, 72.8777];

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full min-h-[420px]">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {toilets.map((toilet) => (
        <Marker key={toilet.id} position={[toilet.latitude, toilet.longitude]} icon={markerIcon(toilet.cleanliness)}>
          <Popup>
            <div className="min-w-[190px] text-slate-900">
              <strong>{toilet.name}</strong>
              <p>{toilet.ward} · {toilet.area}</p>
              <p>Score: {toilet.hygieneScore}% · {toilet.availability}</p>
            </div>
          </Popup>
        </Marker>
      ))}
      {showHeat
        ? toilets.map((toilet) => (
            <Circle
              key={`${toilet.id}-heat`}
              center={[toilet.latitude, toilet.longitude]}
              radius={toilet.cleanliness === "Dirty" ? 520 : toilet.cleanliness === "Moderate" ? 360 : 220}
              pathOptions={{ color: markerHex(toilet.cleanliness), fillColor: markerHex(toilet.cleanliness), fillOpacity: 0.13, weight: 1 }}
            />
          ))
        : null}
    </MapContainer>
  );
}

function CommandHeader({ title, subtitle, isLive, lastSync }: { title: string; subtitle: string; isLive: boolean; lastSync: Date }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 rounded-[2rem] border border-cyan-300/10 bg-slate-950/45 p-5 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">SanitizeAI Command</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={isLive ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "border-amber-300/25 bg-amber-400/10 text-amber-100"}>{isLive ? "Live API" : "Demo Mode"}</Badge>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Sync {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
      </div>
    </motion.div>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[2rem] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {action ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">{action}</span> : null}
      </div>
      {children}
    </motion.section>
  );
}

function MetricCard({ icon: Icon, label, value, suffix, detail, trend }: { icon: LucideIcon; label: string; value: number; suffix: string; detail: string; trend: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300"><Icon size={22} /></div>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">{trend}</span>
      </div>
      <p className="mt-6 text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-tight text-white">{value}<span className="text-xl text-cyan-200">{suffix}</span></p>
      <p className="mt-3 text-sm text-slate-400">{detail}</p>
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-300">{subtitle}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "cyan" | "emerald" | "rose" }) {
  const toneClass = tone === "cyan" ? "text-cyan-300 bg-cyan-300/10" : tone === "emerald" ? "text-emerald-300 bg-emerald-300/10" : "text-rose-300 bg-rose-300/10";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-panel rounded-[2rem] p-5">
      <div className={`inline-flex rounded-2xl p-3 ${toneClass}`}><Icon size={22} /></div>
      <p className="mt-5 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{label}</p>
    </motion.div>
  );
}

function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(6,182,212,0.34),transparent_28%),radial-gradient(circle_at_76%_12%,rgba(20,184,166,0.22),transparent_25%),linear-gradient(135deg,#06111f_0%,#0f172a_48%,#083344_100%)]" />
      <motion.div animate={{ x: [0, 28, 0], y: [0, -18, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-28 top-20 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
      <motion.div animate={{ x: [0, -18, 0], y: [0, 22, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="aurora-grid absolute inset-0 opacity-45" />
    </div>
  );
}

function CityConsoleIllustration() {
  return (
    <div className="relative h-[560px] overflow-hidden rounded-[3rem] border border-cyan-300/15 bg-slate-950/35 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 38, repeat: Infinity, ease: "linear" }} className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10" />
      <svg viewBox="0 0 520 520" className="relative z-10 h-full w-full" role="img" aria-label="Smart city restroom monitoring illustration">
        <defs>
          <linearGradient id="tower" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#67e8f9" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <path d="M74 364 C130 308 183 334 246 275 C302 224 364 235 446 162" fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 14" opacity="0.7" />
        <g fill="rgba(15,23,42,0.9)" stroke="rgba(103,232,249,0.7)" strokeWidth="3">
          <rect x="74" y="288" width="82" height="128" rx="18" />
          <rect x="192" y="230" width="108" height="186" rx="22" />
          <rect x="338" y="260" width="92" height="156" rx="20" />
        </g>
        <g fill="url(#tower)">
          <rect x="94" y="315" width="14" height="64" rx="7" />
          <rect x="122" y="315" width="14" height="64" rx="7" />
          <rect x="224" y="264" width="18" height="92" rx="9" />
          <rect x="258" y="264" width="18" height="92" rx="9" />
          <rect x="367" y="295" width="16" height="74" rx="8" />
          <rect x="397" y="295" width="16" height="74" rx="8" />
        </g>
        <g>
          {[
            [94, 218, "#22c55e"],
            [262, 150, "#06b6d4"],
            [414, 204, "#f59e0b"],
            [342, 92, "#ef4444"],
          ].map(([cx, cy, color]) => (
            <motion.circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="14" fill={color as string} animate={{ r: [10, 16, 10], opacity: [0.65, 1, 0.65] }} transition={{ duration: 2.6, repeat: Infinity, delay: Number(cx) / 120 }} />
          ))}
        </g>
        <path d="M54 420 H466" stroke="rgba(248,250,252,0.4)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-cyan-300/10 px-4 py-10 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
      SanitizeAI Smart Restroom Monitoring System · Flask API ready · React, Vite, Tailwind, Leaflet, Recharts
    </footer>
  );
}

function HygieneBadge({ cleanliness, score }: { cleanliness: Cleanliness; score: number }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${hygieneColors[cleanliness]}`}>{score}% {cleanliness}</span>;
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${className}`}>{children}</span>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function SensorMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function SensorDetail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className="text-cyan-300" size={20} />
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function PublicSensorTile({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[1.5rem] border border-teal-200/70 bg-white/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Icon className="text-teal-600" size={22} />
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">Live</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{helper}</p>
    </div>
  );
}

function StatusMeter({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold text-white">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function AlertRow({ toilet }: { toilet: Restroom }) {
  return (
    <div className="rounded-2xl border border-rose-300/15 bg-rose-500/8 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 text-rose-300" size={20} />
        <div>
          <p className="font-bold text-white">{toilet.name}</p>
          <p className="mt-1 text-sm text-slate-400">{toilet.aiPrediction} · Odor {toilet.odorLevel}% · Humidity {toilet.humidity}%</p>
        </div>
      </div>
    </div>
  );
}

function ActionLine({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className="shrink-0 text-cyan-300" size={20} />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
      </div>
    </div>
  );
}

function UsageHeatmap() {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
      {heatmapCells.map((value, index) => (
        <div key={`${value}-${index}`} className="h-16 rounded-2xl border border-white/5" style={{ background: `rgba(${value > 72 ? "239,68,68" : value > 50 ? "245,158,11" : "6,182,212"}, ${0.18 + value / 180})` }}>
          <div className="flex h-full items-end justify-end p-2 text-xs font-bold text-white/80">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/95 p-3 text-sm shadow-2xl">
      {label ? <p className="mb-2 font-bold text-white">{label}</p> : null}
      {payload.map((item) => (
        <p key={item.name} className="text-slate-300"><span style={{ color: item.color ?? "#06b6d4" }}>●</span> {item.name}: {item.value}</p>
      ))}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30">
      <Waves size={24} strokeWidth={3} />
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16 text-center">
      <p className="text-8xl font-black text-cyan-300">404</p>
      <h1 className="mt-4 text-3xl font-black text-white">Route not found</h1>
      <Link to="/" className="mt-6 rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950">Return home</Link>
    </main>
  );
}

function countCleanliness(toilets: Restroom[]) {
  return toilets.reduce(
    (counts, toilet) => ({ ...counts, [toilet.cleanliness]: counts[toilet.cleanliness] + 1 }),
    { Clean: 0, Moderate: 0, Dirty: 0 } as Record<Cleanliness, number>,
  );
}

function pieData(counts: Record<Cleanliness, number>) {
  return [
    { name: "Clean", value: counts.Clean, color: "#22c55e" },
    { name: "Moderate", value: counts.Moderate, color: "#f59e0b" },
    { name: "Dirty", value: counts.Dirty, color: "#ef4444" },
  ];
}

function markerHex(cleanliness: Cleanliness) {
  if (cleanliness === "Clean") return "#22c55e";
  if (cleanliness === "Moderate") return "#f59e0b";
  return "#ef4444";
}

function riskPredictionClass(level: RiskPrediction["riskLevel"]) {
  if (level === "Low") return "border-emerald-300/25 bg-emerald-400/15 text-emerald-100";
  if (level === "Moderate") return "border-amber-300/25 bg-amber-400/15 text-amber-100";
  if (level === "High") return "border-orange-300/25 bg-orange-400/15 text-orange-100";
  return "border-rose-300/25 bg-rose-500/15 text-rose-100";
}

function resolveQrToToiletId(value: string, toilets: Restroom[]) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = toilets.find((toilet) => toilet.id.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct.id;

  try {
    const url = new URL(trimmed);
    const candidate = url.searchParams.get("toiletId") ?? url.searchParams.get("toilet") ?? url.searchParams.get("id");
    const urlMatch = candidate ? toilets.find((toilet) => toilet.id.toLowerCase() === candidate.toLowerCase()) : undefined;
    if (urlMatch) return urlMatch.id;
  } catch {
    // QR payloads may be plain text, so non-URL values are expected.
  }

  const match = trimmed.toUpperCase().match(/T-\d{3,}/);
  return match ? toilets.find((toilet) => toilet.id.toUpperCase() === match[0])?.id ?? null : null;
}

function markerIcon(cleanliness: Cleanliness) {
  return L.divIcon({
    className: "",
    html: `<span class="sanitiq-marker" style="background:${markerHex(cleanliness)}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function WorkerTokenPage() {
  const [claimed, setClaimed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sanitiq:claimed-tokens") ?? "[]");
    } catch {
      return [];
    }
  });

  const handleClaim = async (id: string) => {
    if (!claimed.includes(id)) {
      const next = [...claimed, id];
      setClaimed(next);
      localStorage.setItem("sanitiq:claimed-tokens", JSON.stringify(next));
      try {
        await fetch("/api/update-motor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motor_time: 30, call: 0 })
        });
      } catch (error) {
        console.error("Failed to update motor time:", error);
      }
    }
  };

  const dayTokens = [1, 2];
  const nightTokens = [1, 2, 3, 4, 5];

  const currentHour = new Date().getHours();
  const isNightShiftActive = currentHour >= 20 || currentHour < 4;

  return (
    <div className="space-y-6">
      <CommandHeader title="Worker Tokens" subtitle="Claim your assigned cleaning tokens for the day and night shifts." isLive lastSync={new Date()} />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Day Shift Tokens" action="2 available">
          <div className="space-y-3">
            {dayTokens.map((num) => {
              const id = `day-${num}`;
              const isClaimed = claimed.includes(id);
              return (
                <div key={id} className="flex items-center justify-between rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-400/20 p-2 text-amber-300"><TicketCheck size={20} /></div>
                    <div>
                      <p className="font-bold text-white">Day Token #{num}</p>
                      <p className="text-sm text-slate-400">Shift: 08:00 AM - 04:00 PM</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleClaim(id)}
                    disabled={isClaimed}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${isClaimed ? 'bg-white/10 text-slate-400 cursor-not-allowed' : 'bg-amber-400 text-amber-950 hover:bg-amber-300'}`}
                  >
                    {isClaimed ? "Claimed" : "Claim token"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Night Shift Tokens" action="5 available">
          <div className="space-y-3">
            {nightTokens.map((num) => {
              const id = `night-${num}`;
              const isClaimed = claimed.includes(id);
              return (
                <div key={id} className="flex items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-400/20 p-2 text-cyan-300"><TicketCheck size={20} /></div>
                    <div>
                      <p className="font-bold text-white">Night Token #{num}</p>
                      <p className="text-sm text-slate-400">Shift: 08:00 PM - 04:00 AM</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleClaim(id)}
                    disabled={isClaimed || !isNightShiftActive}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${isClaimed ? 'bg-white/10 text-slate-400 cursor-not-allowed' : !isNightShiftActive ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-cyan-400 text-cyan-950 hover:bg-cyan-300'}`}
                  >
                    {isClaimed ? "Claimed" : !isNightShiftActive ? "Not Active" : "Claim token"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

  const dayTokens = [1, 2];
  const nightTokens = [1, 2, 3, 4, 5];

  const currentHour = new Date().getHours();
  // Day shift is 08:00 AM to 04:00 PM
  const isDayShiftActive = currentHour >= 8 && currentHour < 16;
  // Night shift is 08:00 PM to 04:00 AM
  const isNightShiftActive = currentHour >= 20 || currentHour < 4;

  return (
    <div className="space-y-6">
      <CommandHeader title="Worker Tokens" subtitle="Claim your assigned cleaning tokens for the day and night shifts." isLive lastSync={new Date()} />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Day Shift Tokens" action="2 available">
          <div className="space-y-3">
            {dayTokens.map((num) => {
              const id = `day-${num}`;
              const isClaimed = claimed.includes(id);
              return (
                <div key={id} className="flex items-center justify-between rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-400/20 p-2 text-amber-300"><TicketCheck size={20} /></div>
                    <div>
                      <p className="font-bold text-white">Day Token #{num}</p>
                      <p className="text-sm text-slate-400">Shift: 08:00 AM - 04:00 PM</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleClaim(id)}
                    disabled={isClaimed || !isDayShiftActive}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${isClaimed ? 'bg-white/10 text-slate-400 cursor-not-allowed' : !isDayShiftActive ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-amber-400 text-amber-950 hover:bg-amber-300'}`}
                  >
                    {isClaimed ? "Claimed" : !isDayShiftActive ? "Not Active" : "Claim the token"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Night Shift Tokens" action="5 available">
          <div className="space-y-3">
            {nightTokens.map((num) => {
              const id = `night-${num}`;
              const isClaimed = claimed.includes(id);
              return (
                <div key={id} className="flex items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-400/20 p-2 text-cyan-300"><TicketCheck size={20} /></div>
                    <div>
                      <p className="font-bold text-white">Night Token #{num}</p>
                      <p className="text-sm text-slate-400">Shift: 08:00 PM - 04:00 AM</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleClaim(id)}
                    disabled={isClaimed || !isNightShiftActive}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${isClaimed ? 'bg-white/10 text-slate-400 cursor-not-allowed' : !isNightShiftActive ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-cyan-400 text-cyan-950 hover:bg-cyan-300'}`}
                  >
                    {isClaimed ? "Claimed" : !isNightShiftActive ? "Not Active" : "Claim token"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function App() {
  const data = useSanitiQData();

  return (
    <BrowserRouter>
      <AppShell isLive={data.isLive} lastSync={data.lastSync}>
        <Routes>
          <Route path="/" element={<HomePage summary={data.summary} toilets={data.toilets} />} />
          <Route path="/public" element={<PublicPortalPage summary={data.summary} toilets={data.toilets} wardRisk={data.wardRisk} />} />
          <Route path="/dashboard" element={<DashboardPage summary={data.summary} toilets={data.toilets} complaints={data.complaints} wardRisk={data.wardRisk} isLive={data.isLive} lastSync={data.lastSync} />} />
          <Route path="/staff/complaints" element={<StaffComplaintsPage complaints={data.complaints} onStatus={data.updateComplaintStatus} />} />
          <Route path="/toilets" element={<ToiletsPage toilets={data.toilets} />} />
          <Route path="/sensors" element={<SensorsPage toilets={data.toilets} />} />
          <Route path="/map" element={<MapPage toilets={data.toilets} />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/outbreak" element={<AnalyticsPage wardRisk={data.wardRisk} toilets={data.toilets} complaints={data.complaints} />} />
          <Route path="/reports" element={<ReportsPage summary={data.summary} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/complaints" element={<ComplaintsPage toilets={data.toilets} onAdd={data.addComplaint} />} />
          <Route path="/tokens" element={<WorkerTokenPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
