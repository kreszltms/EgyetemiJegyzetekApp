import {
  Atom,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  Code2,
  Dna,
  FlaskConical,
  Globe2,
  Landmark,
  Music,
  Palette,
  PenTool,
  Scale,
  Microscope,
  type LucideIcon,
} from "lucide-react";

/** Tárgyakhoz választható ikonkészlet — csak ezekből a nevekből választhat a felhasználó. */
export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Book,
  Calculator,
  FlaskConical,
  Code2,
  Globe2,
  Landmark,
  Palette,
  Music,
  Dna,
  Atom,
  Scale,
  Briefcase,
  Brain,
  Microscope,
  PenTool,
  Building2,
};

export const SUBJECT_ICON_NAMES = Object.keys(SUBJECT_ICONS);

export function getSubjectIcon(name: string | undefined): LucideIcon {
  if (!name) return BookOpen;
  return SUBJECT_ICONS[name] ?? BookOpen;
}
