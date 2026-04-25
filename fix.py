import sys

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add QRCodeSVG import
if 'import { QRCodeSVG }' not in content:
    content = content.replace('import { sanitiqApi } from "./api/sanitiqApi";', 'import { QRCodeSVG } from "qrcode.react";\nimport { sanitiqApi } from "./api/sanitiqApi";')

# 2. Fix SiteNav navItems
old_sitenav = '''        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink'''

new_sitenav = '''        <div className="hidden items-center gap-1 lg:flex">
          {navItems
            .filter((item) => !(item.label === "Complaints" && getStaffSession()?.role === "worker"))
            .map((item) => (
            <NavLink'''
content = content.replace(old_sitenav, new_sitenav)

# 3. Fix MobileNav
old_mobilenav = '''function MobileNav() {
  return (
    <div className="fixed inset-x-3 bottom-3 z-[900] rounded-full border border-cyan-300/20 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileNavItems.map((item) => ('''

new_mobilenav = '''function MobileNav() {
  const [session, setSession] = useState<StaffSession | null>(() => getStaffSession());

  useEffect(() => {
    const handler = () => setSession(getStaffSession());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const currentSession = getStaffSession();
  const visibleNavItems = currentSession?.role === "worker"
    ? mobileNavItems.filter((item) => item.label !== "Complaints")
    : mobileNavItems;

  const colCount = visibleNavItems.length;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[900] rounded-full border border-cyan-300/20 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
        {visibleNavItems.map((item) => ('''
content = content.replace(old_mobilenav, new_mobilenav)

# 4. Add AdminControlsPanel before QrComplaintIntake
old_qr_func = 'function QrComplaintIntake({ toilets, onAdd }: { toilets: Restroom[]; onAdd: (payload: Omit<Complaint, "id" | "createdAt" | "status">) => Promise<void> }) {'

admin_panel = '''function AdminControlsPanel() {
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

'''
content = content.replace(old_qr_func, admin_panel + old_qr_func)

# 5. Insert AdminControlsPanel into QrComplaintIntake
old_scan_panel = '''        <p className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-slate-300">{scanMessage}</p>
      </Panel>

      <div ref={complaintBoxRef} className="space-y-5">'''

new_scan_panel = '''        <p className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-slate-300">{scanMessage}</p>
      </Panel>

      {getStaffSession()?.role === "admin" && (
        <Panel title="Admin Controls" action="Admin only">
          <AdminControlsPanel />
        </Panel>
      )}

      <div ref={complaintBoxRef} className="space-y-5">'''
content = content.replace(old_scan_panel, new_scan_panel)

# 6. Add Worker QR Code back to ToiletModal
old_toilet_modal = '''function ToiletModal({ toilet, onClose }: { toilet: Restroom; onClose: () => void }) {
  return (
    <motion.div'''

new_toilet_modal = '''function ToiletModal({ toilet, onClose }: { toilet: Restroom; onClose: () => void }) {
  const session = getStaffSession();
  const isWorker = session?.role === "worker";

  return (
    <motion.div'''
content = content.replace(old_toilet_modal, new_toilet_modal)

old_toilet_modal_end = '''        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
          <p className="text-sm font-bold text-cyan-100">AI Prediction</p>
          <p className="mt-2 text-slate-200">{toilet.aiPrediction}. Maintenance response target is {toilet.responseTime} with a public rating of {toilet.rating}/5.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}'''

new_toilet_modal_end = '''        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
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
}'''
content = content.replace(old_toilet_modal_end, new_toilet_modal_end)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
