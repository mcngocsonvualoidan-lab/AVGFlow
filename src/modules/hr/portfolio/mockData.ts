
import { PortfolioData } from './types';

// Deterministic Random Helper
const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};

const QUOTES = [
    "Innovation distinguishes between a leader and a follower.",
    "The way to get started is to quit talking and begin doing.",
    "Stay hungry, stay foolish.",
    "Simplicity is the ultimate sophistication.",
    "Digital design is like painting, except the paint never dries.",
    "Creativity is intelligence having fun.",
    "Code is poetry.",
    "Make it simple, but significant.",
    "Everything you can imagine is real.",
    "Quality means doing it right when no one is looking."
];

const SKILLS = [
    "Strategic Planning", "Team Leadership", "Project Management", "UI/UX Design",
    "React Native", "TypeScript", "Digital Marketing", "SEO Optimization",
    "Data Analysis", "Public Speaking", "Content Creation", "Sales Strategy",
    "Negotiation", "Cloud Computing", "Python", "Problem Solving"
];

const HOBBIES = [
    "Photography", "Traveling", "Reading", "Hiking", "Gaming",
    "Cooking", "Music Production", "Meditation", "Cycling", "Coffee Brewing"
];

const COVERS = [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop", // Space
    "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop", // Office
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop", // Neon
    "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=2070&auto=format&fit=crop", // Nature
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop"  // Tech
];

const THEMES = ['cosmic', 'executive', 'creative', 'minimal'] as const;

export const generateMockPortfolio = (user: any): PortfolioData => {
    const seed = hashCode(user.id || user.email || 'default');

    // Helper to get random item based on seed
    const getRandom = <T>(arr: T[], offset = 0): T => arr[Math.floor(seededRandom(seed + offset) * arr.length)];

    // Generate 4-6 random skills
    const numSkills = 4 + Math.floor(seededRandom(seed + 1) * 3);
    const skills = [];
    const usedSkills = new Set();
    for (let i = 0; i < numSkills; i++) {
        const skill = getRandom(SKILLS, i * 10);
        if (!usedSkills.has(skill)) {
            skills.push({
                name: skill,
                level: 60 + Math.floor(seededRandom(seed + i * 5) * 40) // 60-100
            });
            usedSkills.add(skill);
        }
    }

    // Generate Experience (Fake)
    const experience = [
        {
            role: user.role || "Senior Specialist",
            company: "AVGFlow Enterprise",
            duration: "2023 - Present",
            desc: "Leading key initiatives and driving growth in the core business sector."
        },
        {
            role: "Project Manager",
            company: "Tech Innovators Corp",
            duration: "2020 - 2023",
            desc: "Managed cross-functional teams to deliver high-impact digital solutions."
        }
    ];

    return {
        bio: `Experienced ${user.role || 'professional'} with a demonstrated history of working in the ${user.dept || 'industry'}. Skilled in ${skills[0]?.name} and ${skills[1]?.name}. Strong professional with a focus on sustainable growth and innovation.`,
        role_description: `Passionate about ${skills[0]?.name} and creating value through efficient workflows.`,
        quote: getRandom(QUOTES, 100),
        skills,
        experience,
        education: [
            { degree: "Master of Business Administration", school: "National University", year: "2018-2020" },
            { degree: "Bachelor of Science", school: "City University", year: "2014-2018" }
        ],
        hobbies: [getRandom(HOBBIES, 20), getRandom(HOBBIES, 25), getRandom(HOBBIES, 30)],
        socials: {
            linkedin: "linkedin.com/in/demo",
            twitter: "twitter.com/demo",
            website: "portfolio.demo"
        },
        theme: getRandom([...THEMES], 999),
        coverImage: getRandom(COVERS, 55)
    };
};
