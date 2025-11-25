import { fetchAllUsersWeight } from '../user/userProfile.js';

// fetch the user's current weight entry
export function findUsersCurrentWeight(userId){
    const userWeights = fetchAllUsersWeight(userId);
    if (!userWeights || userWeights.length === 0) {
        return null; // No weight entries found
    }
    // Sort weight entries by date in descending order
    const sortedWeights = userWeights.sort((a, b) => new Date(b.date) - new Date(a.date));
    return sortedWeights[0]; // Return the most recent weight entry
}