import React from 'react';

interface BentoBoxProps {
    children: React.ReactNode;
    className?: string;
    bgColor?: string; // Tailwind bg class, e.g., 'bg-sunny'
    onClick?: () => void;
}

/**
 * A reusable "Bento Box" component for the Pop-Retro / Neubrutalism grid layout.
 * Provides consistent thick borders, rounded corners, and shadow effects.
 */
const BentoBox: React.FC<BentoBoxProps> = ({ children, className = '', bgColor = 'bg-white', onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`
        ${bgColor}
        border-4 border-stone-900
        rounded-[1.5rem]
        shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)]
        overflow-hidden
        transition-all duration-200 ease-out
        hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.18)]
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
        >
            {children}
        </div>
    );
};

export default BentoBox;
