
export interface PortfolioData {
    bio: string;
    role_description: string;
    quote: string;
    skills: { name: string; level: number }[]; // level 1-100
    experience: { role: string; company: string; duration: string; desc: string }[];
    education: { degree: string; school: string; year: string }[];
    hobbies: string[];
    socials: { linkedin?: string; twitter?: string; website?: string };
    theme: 'cosmic' | 'executive' | 'creative' | 'minimal';
    coverImage: string;
}

export interface PortfolioProps {
    user: any; // Using any for flexibility with the existing User type
    data: PortfolioData;
    onClose: () => void;
}
