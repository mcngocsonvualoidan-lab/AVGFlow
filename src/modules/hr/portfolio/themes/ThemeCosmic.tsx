
import React from 'react';
import { PortfolioProps } from '../types';
import { motion } from 'framer-motion';
import { Mail, Linkedin, X, Quote } from 'lucide-react';

const ThemeCosmic: React.FC<PortfolioProps> = ({ user, data, onClose }) => {
    return (
        <div className="w-full h-full bg-[#0f172a] text-white overflow-y-auto custom-scrollbar relative">
            <button onClick={onClose} className="fixed top-6 right-6 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md">
                <X size={24} />
            </button>

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative max-w-5xl mx-auto p-6 md:p-12 flex flex-col gap-12">

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                    className="flex flex-col md:flex-row items-center gap-8 md:gap-12"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-48 h-48 md:w-56 md:h-56 rounded-full border-4 border-white/10 shadow-2xl object-cover relative z-10"
                        />
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 mb-2">
                            {user.name}
                        </h1>
                        <h2 className="text-xl md:text-2xl text-slate-400 font-light mb-6 tracking-widest uppercase">
                            {data.experience[0]?.role}
                        </h2>

                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            {user.email && (
                                <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 text-sm hover:bg-indigo-500/20 transition-colors">
                                    <Mail size={14} /> {user.email}
                                </span>
                            )}
                            {data.socials.linkedin && (
                                <span className="px-4 py-2 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-300 flex items-center gap-2 text-sm hover:bg-blue-600/20 transition-colors cursor-pointer">
                                    <Linkedin size={14} /> LinkedIn
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Quote Block */}
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="relative bg-white/5 border border-white/10 p-8 rounded-3xl italic text-lg text-slate-300 text-center"
                >
                    <Quote className="absolute top-4 left-4 text-indigo-500 opacity-30" size={40} />
                    "{data.quote}"
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                        className="space-y-8"
                    >
                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                            <h3 className="text-indigo-400 font-bold uppercase tracking-wider mb-4">About Me</h3>
                            <p className="text-slate-300 leading-relaxed text-sm">
                                {data.bio}
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                            <h3 className="text-pink-400 font-bold uppercase tracking-wider mb-4">Skills</h3>
                            <div className="space-y-4">
                                {data.skills.map((skill, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-xs mb-1 text-slate-400">
                                            <span>{skill.name}</span>
                                            <span>{skill.level}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }} whileInView={{ width: `${skill.level}%` }}
                                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                        className="md:col-span-2 space-y-8"
                    >
                        {/* Experience */}
                        <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl">
                            <h3 className="text-emerald-400 font-bold uppercase tracking-wider mb-6 flex items-center gap-2">Experience</h3>
                            <div className="space-y-8">
                                {data.experience.map((exp, i) => (
                                    <div key={i} className="relative pl-6 border-l border-white/10">
                                        <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                                        <h4 className="text-xl font-bold text-white">{exp.role}</h4>
                                        <div className="flex justify-between items-center mt-1 mb-2">
                                            <span className="text-indigo-300 font-medium">{exp.company}</span>
                                            <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded">{exp.duration}</span>
                                        </div>
                                        <p className="text-sm text-slate-400">{exp.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Education & Hobbies */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                                <h3 className="text-blue-400 font-bold uppercase tracking-wider mb-4">Education</h3>
                                <ul className="space-y-4">
                                    {data.education.map((edu, i) => (
                                        <li key={i}>
                                            <div className="font-bold text-slate-200">{edu.degree}</div>
                                            <div className="text-xs text-slate-400">{edu.school} • {edu.year}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                                <h3 className="text-amber-400 font-bold uppercase tracking-wider mb-4">Interests</h3>
                                <div className="flex flex-wrap gap-2">
                                    {data.hobbies.map((hobby, i) => (
                                        <span key={i} className="px-3 py-1 bg-amber-500/10 text-amber-300 text-xs rounded-lg border border-amber-500/20">
                                            {hobby}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ThemeCosmic;
