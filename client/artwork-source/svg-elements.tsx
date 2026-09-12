// Build-time SVG primitives. Runtime screens use bundled PNGs on every platform.
import { createElement } from 'react';
import type { SVGProps } from 'react';

type ArtProps = SVGProps<SVGSVGElement> & { accessibilityElementsHidden?: boolean; importantForAccessibility?: string };
export default function Svg({ accessibilityElementsHidden: _hidden, importantForAccessibility: _importance, ...props }: ArtProps) {
  return createElement('svg', { ...props, xmlns: 'http://www.w3.org/2000/svg' });
}

export const Circle = (props: SVGProps<SVGCircleElement>) => createElement('circle', props);
export const Ellipse = (props: SVGProps<SVGEllipseElement>) => createElement('ellipse', props);
export const Path = (props: SVGProps<SVGPathElement>) => createElement('path', props);
export const Rect = (props: SVGProps<SVGRectElement>) => createElement('rect', props);
export const G = (props: SVGProps<SVGGElement>) => createElement('g', props);
export const Defs = (props: SVGProps<SVGDefsElement>) => createElement('defs', props);
export const ClipPath = (props: SVGProps<SVGClipPathElement>) => createElement('clipPath', props);
export const LinearGradient = (props: SVGProps<SVGLinearGradientElement>) => createElement('linearGradient', props);
export const RadialGradient = (props: SVGProps<SVGRadialGradientElement>) => createElement('radialGradient', props);
export const Stop = (props: SVGProps<SVGStopElement>) => createElement('stop', props);
