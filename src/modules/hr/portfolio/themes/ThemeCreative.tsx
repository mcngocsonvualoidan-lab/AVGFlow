
import React from 'react';
import { PortfolioProps } from '../types';
import { motion } from 'framer-motion';
import { X, ArrowUpRight } from 'lucide-react';

const ThemeCreative: React.FC<PortfolioProps> = ({ user, data, onClose }) => {
    return (
        <div className="w-full h-full bg-[#EAEAEA] text-[#111] overflow-y-auto custom-scrollbar relative font-sans selection:bg-yellow-300">
            <button onClick={onClose} className="fixed top-6 right-6 z-50 p-3 bg-black text-white hover:bg-yellow-400 hover:text-black rounded-full transition-all mix-blend-difference">
                <X size={24} />
            </button>

            {/* Giant Graphic Header */}
            <div className="h-[60vh] md:h-[70vh] w-full relative overflow-hidden flex items-end p-6 md:p-12 bg-yellow-400">
                <img
                    src={user.avatar}
                    className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-multiply opacity-50"
                />
                <div className="relative z-10 w-full">
                    <motion.h1
                        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        className="text-[12vw] leading-[0.85] font-black uppercase tracking-tighter"
                    >
                        {user.name.split(' ').slice(-1)[0]}
                    </motion.h1>
                    <motion.h2
                        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                        className="text-2xl md:text-4xl font-bold bg-black text-white inline-block px-4 py-1 mt-4"
                    >
                        {data.experience[0]?.role}
                    </motion.h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen">
                {/* Yellow Bar */}
                <div className="hidden md:block md:col-span-1 bg-black text-white py-12 flex flex-col items-center justify-between border-r border-white/20">
                    <span className="writing-vertical-rl text-xs font-mono tracking-widest uppercase rotate-180">Portfolio 2026</span>
                    <span className="writing-vertical-rl text-xs font-mono tracking-widest uppercase rotate-180">AVG Flow</span>
                </div>

                <div className="md:col-span-7 bg-white p-8 md:p-16 border-b md:border-b-0 md:border-r border-black">
                    <h3 className="text-6xl font-black mb-12">HELLO.</h3>
                    <p className="text-2xl md:text-3xl font-light leading-snug mb-12">
                        {data.bio}
                    </p>

                    <div className="grid grid-cols-2 gap-y-12 gap-x-8">
                        <div>
                            <span className="block text-xs font-bold uppercase tracking-widest mb-4 border-b-4 border-yellow-400 pb-2 w-12">Skills</span>
                            <ul className="space-y-2 text-lg font-bold">
                                {data.skills.map((s, i) => <li key={i}>{s.name}</li>)}
                            </ul>
                        </div>
                        <div>
                            <span className="block text-xs font-bold uppercase tracking-widest mb-4 border-b-4 border-yellow-400 pb-2 w-12">Contact</span>
                            <ul className="space-y-2 text-lg">
                                <li>{user.email}</li>
                                <li>{user.phone || 'N/A'}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-4 bg-[#F5F5F5] p-8 md:p-12 flex flex-col gap-12">
                    <div>
                        <span className="block text-xs font-bold uppercase tracking-widest mb-6 bg-black text-white px-2 py-1 w-fit">Work Experience</span>
                        <div className="space-y-8">
                            {data.experience.map((exp, i) => (
                                <div key={i} className="group cursor-pointer">
                                    <h4 className="text-xl font-bold group-hover:text-yellow-600 transition-colors flex items-center justify-between">
                                        {exp.role} <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </h4>
                                    <p className="text-sm font-mono text-gray-500 mb-2">{exp.company}</p>
                                    <p className="text-sm">{exp.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-black text-white p-8 -mx-8 -mb-12 md:mb-0 md:mx-0 md:flex-1 flex items-center justify-center text-center italic">
                        "{data.quote}"
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeCreative;
