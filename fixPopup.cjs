const fs = require('fs');
let code = fs.readFileSync('src/modules/orders/DesignTicketPopup.tsx', 'utf-8');

// 1. Add import
code = code.replace(`import { supabase } from '../../lib/supabase';`, `import { supabase } from '../../lib/supabase';\nimport FloatingTicketChat from '../../components/FloatingTicketChat';`);

// 2. Remove ChatPanel
code = code.replace(/\/\/ ════════════════════════════════════════════════════════════════\n\/\/ CHAT PANEL[\s\S]*?<\/div>\n    <\/div>\n\);\n/, '');

// 3. Remove chat states and handle functions
code = code.replace(/    const \[newMsg, setNewMsg\] = useState\(''\);\n    const \[sending, setSending\] = useState\(false\);\n    const \[chatErr, setChatErr\] = useState\(''\);\n    const endRef = useRef<HTMLDivElement>\(null\);\n    const fileRef = useRef<HTMLInputElement>\(null\);\n/, '');

code = code.replace(/    \/\/ ── Send \(Supabase \+ Optimistic UI\) ──[\s\S]*?fileRef\.current\.value = ''; }\n    \}, \[ticket\.id, ticket\.ticketCode, adminEmail\]\);\n/, '');

code = code.replace(/    const chatProps: ChatPanelProps = \{ ticketId: ticket\.id, messages[\s\S]*?fileRef \};\n/, '');

// 4. Change mobile tabs
code = code.replace(/<button onClick=\{\(\) => setMobileTab\('chat'\)\} className=\{clsx\("flex-1 py-2\.5 text-xs font-bold flex items-center justify-center gap-1\.5 border-b-2 transition-all relative",[\s\S]*?<\/button>\n/, '');

// 5. Change content panels
code = code.replace(/                    <div className=\{clsx\(\n                        "md:w-\[55%\] md:flex md:flex-col",\n                        \(mobileTab === 'chat' \|\| mobileTab === 'timeline'\) \? 'flex flex-col' : 'hidden'\n                    \)\} style=\{\{ minHeight: 0 \}\}>\n                        \{\/\* Desktop: tab switcher for right panel \*\/\}\n                        <div className="hidden md:flex border-b border-slate-200\/50 dark:border-white\/10 bg-white\/50 dark:bg-slate-800\/50 shrink-0">\n                            <button onClick=\{\(\) => setRightTab\('chat'\)\}[\s\S]*?<\/div>\n\n                        \{\/\* Chat or Timeline content \*\/\}\n                        \{\(\(mobileTab === 'chat'\) \|\| \(mobileTab !== 'timeline' && rightTab === 'chat'\)\) && \(\n                            <ChatPanel \{\.\.\.chatProps\} className="flex-1 min-h-0" \/>\n                        \)\}\n                        \{\(\(mobileTab === 'timeline'\) \|\| \(mobileTab !== 'chat' && rightTab === 'timeline'\)\) && \(/, `                    <div className={clsx(\n                        "md:w-[55%] md:flex md:flex-col",\n                        mobileTab === 'timeline' ? 'flex flex-col' : 'hidden md:flex'\n                    )} style={{ minHeight: 0 }}>\n                        {/* Timeline content */}\n                        (`);

code = code.replace(/                                    \);\n                                \}\)\(\)\}\n                            <\/div>\n                        \)\}/, `                                    );\n                                })()}\n                            </div>\n                        )`);

// 6. Insert FloatingTicketChat before LIGHTBOX
code = code.replace(/            \{\/\* ─── Image Lightbox ─── \*\/\}/, `            {/* ─── Floating Chat ─── */}\n            <FloatingTicketChat ticketId={ticket.id} ticketCode={ticket.ticketCode} customerName={ticket.brandName || 'Khách hàng'} isAdmin={true} adminEmail={adminEmail} adminName={adminName} />\n\n            {/* ─── Image Lightbox ─── */}`);

// Write back
fs.writeFileSync('src/modules/orders/DesignTicketPopup.tsx', code);
