import React from 'react';
import type { BuiltinAgentIconKey } from '@shared/agentIcons';

/**
 * Built-in agent avatars: a warm disc with a two-tone silhouette, drawn at
 * 64x64 so they scale cleanly from the 20px sidebar chip to the 96px welcome
 * avatar. Like the gradients in utils/agentColors.ts these are illustration
 * assets with their own fixed palette, not theme chrome.
 */
interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

interface Palette {
  disc: string;
  ink: string;
  accent: string;
}

function Disc({ palette }: { palette: Palette }) {
  return (
    <>
      <circle cx="32" cy="32" r="32" fill={palette.disc} />
      <circle cx="32" cy="32" r="30.5" fill="none" stroke={palette.ink} strokeOpacity="0.18" strokeWidth="1" />
    </>
  );
}

const OWL: Palette = { disc: '#EFE2CE', ink: '#4E5F70', accent: '#F7EFE2' };
const WHALE: Palette = { disc: '#DCE7EC', ink: '#3F5D74', accent: '#F4F9FB' };
const FOX: Palette = { disc: '#F3DFD0', ink: '#B4623C', accent: '#FBF1E8' };
const CAT: Palette = { disc: '#E3E9DE', ink: '#5C6B57', accent: '#F7FAF4' };
const MOUNTAIN: Palette = { disc: '#EFE6D2', ink: '#6E7A5E', accent: '#E7C98A' };
const STAR: Palette = { disc: '#E5E1EE', ink: '#6A5E90', accent: '#F6F3FC' };
const LEAF: Palette = { disc: '#E1EAE0', ink: '#4F7A5C', accent: '#F3F8F2' };
const SUN: Palette = { disc: '#F3E5C9', ink: '#C08A2E', accent: '#FBEFD6' };

function Owl({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={OWL} />
      <path d="M14 20 L17 7 L27 15 Z" fill={OWL.ink} />
      <path d="M50 20 L47 7 L37 15 Z" fill={OWL.ink} />
      <path
        d="M32 13 C44 13 52 23 52 34 C52 46 44 54 32 54 C20 54 12 46 12 34 C12 23 20 13 32 13 Z"
        fill={OWL.ink}
      />
      <circle cx="24" cy="31" r="7.5" fill={OWL.accent} />
      <circle cx="40" cy="31" r="7.5" fill={OWL.accent} />
      <circle cx="24" cy="31" r="3.2" fill={OWL.ink} />
      <circle cx="40" cy="31" r="3.2" fill={OWL.ink} />
      <path d="M32 38 L28.5 44 L35.5 44 Z" fill={OWL.accent} />
    </svg>
  );
}

function Whale({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={WHALE} />
      <path d="M44 20 C44 15 40 12 36 12" stroke={WHALE.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M52 20 C52 16 49 14 46 14" stroke={WHALE.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.45" />
      <path
        d="M8 38 C8 28 20 21 32 23 C45 25 52 32 52 38 C52 45 44 50 32 50 C20 50 8 46 8 38 Z"
        fill={WHALE.ink}
      />
      <path d="M50 34 L62 25 L59 37 L63 45 L50 42 Z" fill={WHALE.ink} />
      <circle cx="24" cy="34" r="2.6" fill={WHALE.accent} />
      <path d="M14 40 C20 43 28 44 34 43" stroke={WHALE.accent} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.55" />
    </svg>
  );
}

function Fox({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={FOX} />
      <path d="M32 55 L10 35 L17 12 L27 25 L37 25 L47 12 L54 35 Z" fill={FOX.ink} />
      <path d="M32 55 L20 40 L27 25 L37 25 L44 40 Z" fill={FOX.accent} opacity="0.35" />
      <circle cx="24" cy="33" r="2.6" fill={FOX.accent} />
      <circle cx="40" cy="33" r="2.6" fill={FOX.accent} />
      <path d="M32 41 L28 45 L36 45 Z" fill={FOX.accent} opacity="0.8" />
    </svg>
  );
}

function Cat({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={CAT} />
      <path d="M16 28 L19 9 L32 21 Z" fill={CAT.ink} />
      <path d="M48 28 L45 9 L32 21 Z" fill={CAT.ink} />
      <circle cx="32" cy="36" r="17" fill={CAT.ink} />
      <circle cx="25" cy="34" r="2.6" fill={CAT.accent} />
      <circle cx="39" cy="34" r="2.6" fill={CAT.accent} />
      <path d="M32 42 L29.5 45 L34.5 45 Z" fill={CAT.accent} opacity="0.8" />
      <path d="M8 34 L22 36" stroke={CAT.ink} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M56 34 L42 36" stroke={CAT.ink} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function Mountain({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={MOUNTAIN} />
      <circle cx="45" cy="19" r="7" fill={MOUNTAIN.accent} />
      <path d="M4 52 L23 20 L42 52 Z" fill={MOUNTAIN.ink} />
      <path d="M23 20 L30 32 L16 32 Z" fill={MOUNTAIN.accent} opacity="0.85" />
      <path d="M28 52 L42 27 L58 52 Z" fill={MOUNTAIN.ink} opacity="0.75" />
    </svg>
  );
}

function Star({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={STAR} />
      <path
        d="M32 12 L37.3 24.7 L51 25.8 L40.6 34.8 L43.8 48.2 L32 41 L20.2 48.2 L23.4 34.8 L13 25.8 L26.7 24.7 Z"
        fill={STAR.ink}
      />
      <circle cx="32" cy="33" r="3" fill={STAR.accent} opacity="0.85" />
    </svg>
  );
}

function Leaf({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={LEAF} />
      <path d="M32 9 C47 20 51 39 32 56 C13 39 17 20 32 9 Z" fill={LEAF.ink} />
      <path d="M32 14 L32 51" stroke={LEAF.accent} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <path d="M32 24 L23 31 M32 24 L41 31 M32 36 L24 42 M32 36 L40 42" stroke={LEAF.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />
    </svg>
  );
}

function Sun({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <Disc palette={SUN} />
      <circle cx="32" cy="32" r="13" fill={SUN.ink} />
      <g stroke={SUN.ink} strokeWidth="3" strokeLinecap="round">
        <path d="M32 8 L32 15" />
        <path d="M32 49 L32 56" />
        <path d="M8 32 L15 32" />
        <path d="M49 32 L56 32" />
        <path d="M15 15 L20 20" />
        <path d="M44 44 L49 49" />
        <path d="M49 15 L44 20" />
        <path d="M20 44 L15 49" />
      </g>
    </svg>
  );
}

export const AGENT_ICONS: Record<BuiltinAgentIconKey, React.FC<IconProps>> = {
  owl: Owl,
  whale: Whale,
  fox: Fox,
  cat: Cat,
  mountain: Mountain,
  star: Star,
  leaf: Leaf,
  sun: Sun,
};
