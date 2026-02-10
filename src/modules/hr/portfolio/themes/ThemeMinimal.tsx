
import React from 'react';
import { PortfolioProps } from '../types';
import { X } from 'lucide-react';

const ThemeMinimal: React.FC<PortfolioProps> = ({ user, data, onClose }) => {
    return (
        <div className="w-full h-full bg-white text-slate-800 overflow-y-auto custom-scrollbar relative font-sans">
            <button onClick={onClose} className="fixed top-8 right-8 z-50 p-2 hover:bg-slate-100 rounded-full transition-all">
                <X size={24} strokeWidth={1} />
            </button>

            <div className="max-w-3xl mx-auto py-24 px-8">
                <div className="text-center mb-24">
                    <img src={user.avatar} className="w-32 h-32 rounded-full mx-auto mb-8 grayscale opacity-90 object-cover" />
                    <h1 className="text-3xl font-light tracking-[0.2em] uppercase mb-4 text-slate-900">{user.name}</h1>
                    <p className="text-slate-500 tracking-widest text-xs uppercase">{data.experience[0]?.role}</p>
                </div>

                <div className="space-y-24">
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-100 pb-4">Biography</h2>
                        <p className="text-xl md:text-2xl font-light leading-relaxed text-slate-800">
                            {data.bio} {data.role_description}
                        </p>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-100 pb-4">Experience</h2>
                            <div className="space-y-8">
                                {data.experience.map((exp, i) => (
                                    <div key={i}>
                                        <div className="text-lg font-medium">{exp.role}</div>
                                        <div className="text-slate-400 text-sm mb-2">{exp.company}</div>
                                        <div className="text-slate-600 font-light text-sm">{exp.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-100 pb-4">Capabilities</h2>
                            <div className="flex flex-wrap gap-x-8 gap-y-4">
                                {data.skills.map((s, i) => (
                                    <span key={i} className="text-slate-600 font-light">{s.name}</span>
                                ))}
                            </div>

                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-100 pb-4 mt-12">Education</h2>
                            {data.education.map((edu, i) => (
                                <div key={i} className="mb-4">
                                    <div className="text-slate-800">{edu.degree}</div>
                                    <div className="text-slate-400 text-sm">{edu.school}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <blockquote className="text-center text-slate-400 italic font-serif">
                            "{data.quote}"
                        </blockquote>
                    </section>
                </div>

                <div className="mt-24 pt-12 border-t border-slate-100 text-center text-xs text-slate-300 tracking-widest uppercase">
                    Copyight 2026 • {user.name} • AVGFlow System
                </div>
            </div>
        </div>
    );
};

export default ThemeMinimal;
