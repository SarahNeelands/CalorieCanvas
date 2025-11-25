import mockUsers from "../Data/mockDatabase.js";

export async function fetchUserById(userId){
    return mockUsers.find(u => u.id === userId);
}
// updates the users profile with new data
export async function updateUserProfile(userId, profileData){
    const index = mockUsers.findIndex(u => u.id === userId);
    if (index === -1) {
        throw new Error("User not found");
    }
    mockUsers[index] = {
        ...mockUsers[index],
        ...profileData
    };
    return mockUsers[index];
}

export async function updateUserCalorieGoal(userId,calorieGoal){
    const index = mockUsers.findIndex(u => u.id === userId);    
    if (index === -1) {
        throw new Error("User not found");
    }
    mockUsers[index].calorieGoal = calorieGoal;
    return mockUsers[index];
}
// fetch all recorded weights for user
export async function fetchAllUsersWeight(userId)
{
    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
        throw new Error("User not found");
    }
    return user.weightEntries || [];

}

// add a new weight entry for user
export async function addUserWeightEntry(userId, weightEntry)
{
    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
        throw new Error("User not found");
    }
    user.weightEntries.push(weightEntry);
    return weightEntry;
}