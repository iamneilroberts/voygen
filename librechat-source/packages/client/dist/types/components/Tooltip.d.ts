/// <reference types="react" />
import * as Ariakit from '@ariakit/react';
import './Tooltip.css';
interface TooltipAnchorProps extends Ariakit.TooltipAnchorProps {
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    role?: string;
    enableHTML?: boolean;
}
export declare const TooltipAnchor: import("react").ForwardRefExoticComponent<Omit<TooltipAnchorProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export {};
//# sourceMappingURL=Tooltip.d.ts.map