import { mockDailyTotals } from "../Data/mockDatabase";
import { v4 as uuid } from "uuid";
// saves daily totals for user on date
export function saveDailyTotals(userId, dateStr, totals){
    const index = dailyTotals.findIndex(
    entry => entry.userId === userId && entry.date === dateStr);
    if (index !== -1) {
        // Update existing
        dailyTotals[index] = {
        userId,
        date: dateStr,
        macros: totals.macros,
        micros: totals.micros
        };
        return dailyTotals[index];
    }
    const newEntry = {
        userId,
        date: dateStr,
        macros: totals.macros,
        micros: totals.micros
    };
    dailyTotals.push(newEntry);
    return newEntry;
}

// returns daily totals for user on date
export async function getDayTotals(userId, dateStr){
    return dailyTotals.find(
    entry => entry.userId === userId && entry.date === dateStr);
}
// returns daily totals for user in date range
export async function getRangeTotals(userId, startDateStr, endDateStr){
    return dailyTotals.filter(entry => 
        entry.userId === userId && 
        entry.date >= startDateStr && 
        entry.date <= endDateStr);
}

// returns all daily totals for user
export async function getAllTotals(userId){
    return dailyTotals.filter(entry => entry.userId === userId);
}
