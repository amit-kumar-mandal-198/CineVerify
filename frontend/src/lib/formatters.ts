import type { ClaimCategory, ExtractedEntities } from "@/types/api";

export const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  movie_announcement: "Movie Announcement",
  casting: "Casting",
  release_update: "Release Update",
  box_office: "Box Office",
};

export const ENTITY_LABELS: Record<keyof ExtractedEntities, string> = {
  movie: "Movie",
  person: "Person",
  production_house: "Production House",
  date: "Date",
  platform: "Platform",
  amount: "Amount",
};

export function formatVerificationDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}
