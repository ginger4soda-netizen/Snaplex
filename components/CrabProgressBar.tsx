import React from 'react';

interface CrabProgressBarProps {
    progress: number; // 0-100
    isComplete: boolean;
}

/**
 * A fun progress bar featuring a crab digging through sand.
 * The crab moves from left to right as progress increases.
 */
const CrabProgressBar: React.FC<CrabProgressBarProps> = ({ progress, isComplete }) => {
    return (
        <div className="flex items-center gap-3 w-full">
            {/* Progress Track (Sand) */}
            <div className="flex-1 h-2 bg-sunny/30 rounded-full overflow-hidden relative">
                {/* Progress Fill */}
                <div
                    className="h-full bg-sunny rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
                {/* Crab Icon */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
                    style={{ left: `calc(${Math.min(progress, 95)}% - 8px)` }}
                >
                    <span
                        className={`text-lg ${isComplete ? '' : 'animate-[wiggle_0.3s_ease-in-out_infinite]'}`}
                        style={{ display: 'inline-block' }}
                    >
                        🦀
                    </span>
                </div>
            </div>

            {/* Custom CSS for wiggle animation */}
            <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateY(-50%) rotate(-5deg); }
          50% { transform: translateY(-50%) rotate(5deg); }
        }
      `}</style>
        </div>
    );
};

export default CrabProgressBar;
