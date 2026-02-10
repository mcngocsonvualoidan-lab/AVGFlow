
import React from 'react';
import { PortfolioProps } from '../types';
import { Mail, Phone, X, Award, Briefcase } from 'lucide-react';

const ThemeExecutive: React.FC<PortfolioProps> = ({ user, data, onClose }) => {
    return (
        <div className="w-full h-full bg-[#f8fafc] text-slate-800 overflow-y-auto custom-scrollbar relative font-serif">
            <button onClick={onClose} className="fixed top-6 right-6 z-50 p-2 bg-slate-900 text-white hover:bg-slate-700 rounded transition-all shadow-lg">
                <X size={20} />
            </button>

            <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-2xl my-0 md:my-10">
                {/* Header */}
                <div className="bg-[#1e293b] text-white p-12 md:p-16 flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#334155] rounded-bl-full opacity-50"></div>

                    <img
                        src={user.avatar}
                        className="w-40 h-40 rounded-full border-4 border-white object-cover shadow-xl z-10"
                    />
                    <div className="text-center md:text-left z-10">
                        <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">{user.name}</h1>
                        <p className="text-xl text-slate-300 uppercase tracking-widest font-sans font-light">{data.experience[0]?.role}</p>
                        <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4 text-sm font-sans text-slate-400">
                            {user.email && <span className="flex items-center gap-2"><Mail size={14} /> {user.email}</span>}
                            {user.phone && <span className="flex items-center gap-2"><Phone size={14} /> {user.phone}</span>}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                    {/* Left Sidebar */}
                    <div className="bg-[#f1f5f9] p-8 md:p-12 border-r border-slate-200">
                        <section className="mb-10">
                            <h3 className="text-slate-900 font-sans font-bold uppercase tracking-widest border-b-2 border-slate-300 pb-2 mb-4 text-sm">Profile</h3>
                            <p className="text-slate-600 leading-relaxed text-sm italic">
                                "{data.quote}"
                            </p>
                        </section>

                        <section className="mb-10">
                            <h3 className="text-slate-900 font-sans font-bold uppercase tracking-widest border-b-2 border-slate-300 pb-2 mb-4 text-sm">Core SKills</h3>
                            <ul className="space-y-3">
                                {data.skills.slice(0, 6).map((skill, i) => (
                                    <li key={i} className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">{skill.name}</span>
                                        <div className="w-full h-1 bg-slate-300 mt-1">
                                            <div className="h-full bg-slate-800" style={{ width: `${skill.level}%` }}></div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-slate-900 font-sans font-bold uppercase tracking-widest border-b-2 border-slate-300 pb-2 mb-4 text-sm">Education</h3>
                            <div className="space-y-4">
                                {data.education.map((edu, i) => (
                                    <div key={i}>
                                        <div className="font-bold text-slate-800 text-sm">{edu.degree}</div>
                                        <div className="text-xs text-slate-500 italic">{edu.school}, {edu.year}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Main Content */}
                    <div className="col-span-2 p-8 md:p-12 font-sans">
                        <section className="mb-12">
                            <h3 className="text-2xl font-serif font-bold text-slate-800 mb-6 flex items-center gap-3">
                                <Briefcase className="text-slate-400" /> Work Experience
                            </h3>
                            <div className="space-y-8 border-l-2 border-slate-200 pl-6 ml-2">
                                {data.experience.map((exp, i) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-white"></div>
                                        <h4 className="text-lg font-bold text-slate-900">{exp.role}</h4>
                                        <div className="text-slate-500 font-medium mb-2">{exp.company} | {exp.duration}</div>
                                        <p className="text-slate-600 leading-relaxed text-sm text-justify">
                                            {exp.desc} {data.bio}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h3 className="text-2xl font-serif font-bold text-slate-800 mb-6 flex items-center gap-3">
                                <Award className="text-slate-400" /> Expertise Areas
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {data.hobbies.map((hobby, i) => (
                                    <div key={i} className="bg-slate-50 p-4 rounded border border-slate-100">
                                        <span className="font-bold text-slate-700">{hobby}</span>
                                    </div>
                                ))}
                                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                                    <span className="font-bold text-slate-700">Team Leadership</span>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeExecutive;
