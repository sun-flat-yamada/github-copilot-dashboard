import { EnrichedUserSeat, ReportUserDetail } from '../../domain/entities/copilot.js';

export class FilterService {
  static filterSeatsByTags(seats: EnrichedUserSeat[], tags: string[]): EnrichedUserSeat[] {
    if (!tags || tags.length === 0) return seats;
    return seats.filter((s) => {
      if (!s.tags || s.tags.length === 0) return false;
      return tags.every((t) => s.tags!.includes(t));
    });
  }

  static filterReportUsersByTags(users: ReportUserDetail[], tags: string[]): ReportUserDetail[] {
    if (!tags || tags.length === 0) return users;
    return users.filter((u) => {
      if (!u.tags || u.tags.length === 0) return false;
      return tags.every((t) => u.tags!.includes(t));
    });
  }

  static matchesAllTags(userTags: string[] | undefined, filterTags: string[]): boolean {
    if (filterTags.length === 0) return true;
    if (!userTags || userTags.length === 0) return false;
    return filterTags.every((t) => userTags.includes(t));
  }
}
