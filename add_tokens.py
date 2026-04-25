import sys

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add "Tokens" to navItems
old_nav_items = '''const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Toilets", href: "/toilets", icon: ShieldCheck },
  { label: "Map", href: "/map", icon: MapPin },
  { label: "AI Risk", href: "/outbreak", icon: Radar },
  { label: "Complaints", href: "/complaints", icon: ClipboardList },
];'''

new_nav_items = '''const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Toilets", href: "/toilets", icon: ShieldCheck },
  { label: "Map", href: "/map", icon: MapPin },
  { label: "AI Risk", href: "/outbreak", icon: Radar },
  { label: "Complaints", href: "/complaints", icon: ClipboardList },
  { label: "Tokens", href: "/tokens", icon: TicketCheck },
];'''
content = content.replace(old_nav_items, new_nav_items)

# 2. Add "Tokens" to mobileNavItems
old_mobile_nav = '''const mobileNavItems = navItems.filter((item) => ["Home", "Dashboard", "Toilets", "Map", "Complaints"].includes(item.label));'''
new_mobile_nav = '''const mobileNavItems = navItems.filter((item) => ["Home", "Dashboard", "Toilets", "Map", "Complaints", "Tokens"].includes(item.label));'''
content = content.replace(old_mobile_nav, new_mobile_nav)

# 3. Update SiteNav filter
old_sitenav_filter = '''.filter((item) => !(item.label === "Complaints" && getStaffSession()?.role === "worker"))'''
new_sitenav_filter = '''.filter((item) => {
              const role = getStaffSession()?.role;
              if (item.label === "Complaints" && role === "worker") return false;
              if (item.label === "Tokens" && role !== "worker") return false;
              return true;
            })'''
content = content.replace(old_sitenav_filter, new_sitenav_filter)

# 4. Update MobileNav filter
old_mobilenav_filter = '''  const visibleNavItems = session?.role === "worker"
    ? mobileNavItems.filter((item) => item.label !== "Complaints")
    : mobileNavItems;'''
new_mobilenav_filter = '''  const role = session?.role;
  const visibleNavItems = mobileNavItems.filter((item) => {
    if (item.label === "Complaints" && role === "worker") return false;
    if (item.label === "Tokens" && role !== "worker") return false;
    return true;
  });'''
content = content.replace(old_mobilenav_filter, new_mobilenav_filter)

# 5. Inject WorkerTokenPage component before export default function App()
worker_token_page = '''function WorkerTokenPage() {
  const [claimed, setClaimed] = useState<string[]>([]);

  const handleClaim = (id: string) => {
    if (!claimed.includes(id)) {
      setClaimed((prev) => [...prev, id]);
    }
  };

  const dayTokens = [1, 2];
  const nightTokens = [1, 2, 3, 4, 5];

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
                    {isClaimed ? "Claimed" : "Claim the token"}
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
                    disabled={isClaimed}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${isClaimed ? 'bg-white/10 text-slate-400 cursor-not-allowed' : 'bg-cyan-400 text-cyan-950 hover:bg-cyan-300'}`}
                  >
                    {isClaimed ? "Claimed" : "Claim token"}
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

export default function App()'''
content = content.replace('export default function App()', worker_token_page)

# 6. Add route
old_route = '''          <Route path="/login" element={<LoginPage />} />'''
new_route = '''          <Route path="/tokens" element={<WorkerTokenPage />} />\n          <Route path="/login" element={<LoginPage />} />'''
content = content.replace(old_route, new_route)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updates applied to App.tsx")
