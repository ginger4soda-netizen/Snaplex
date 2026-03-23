import React from 'react';

interface AnimatedTextProps {
    text: string;
    className?: string;
    baseDelay?: number; // Base delay before animation starts (in seconds)
    staggerDelay?: number; // Delay between each letter (in seconds)
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

const AnimatedText: React.FC<AnimatedTextProps> = ({
    text,
    className = '',
    baseDelay = 0,
    staggerDelay = 0.03,
    as: Tag = 'span'
}) => {
    // Split text into letters, preserving spaces
    const letters = text.split('');

    return (
        <Tag className={className}>
            {letters.map((letter, index) => (
                <span key={index} className="letter-mask">
                    <span
                        className="animate-letter"
                        style={{
                            animationDelay: `${baseDelay + index * staggerDelay}s`,
                            // Preserve spaces
                            whiteSpace: letter === ' ' ? 'pre' : 'normal'
                        }}
                    >
                        {letter === ' ' ? '\u00A0' : letter}
                    </span>
                </span>
            ))}
        </Tag>
    );
};

export default AnimatedText;
