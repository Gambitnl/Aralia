import React from 'react';

// The audit already produces a spell-specific summary for each supported bucket.
// This helper keeps that "what is actually wrong with this spell?" sentence in
// one place so every bucket panel surfaces it the same way.

export function renderBucketProblem(problem: string | null | undefined): React.ReactNode {
    if (!problem || problem.trim().length === 0) return null;
    return <li>- What is wrong: {problem}</li>;
}
