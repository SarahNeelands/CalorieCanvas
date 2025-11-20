import mockDatabase from "../Data/mockDatabase.js";

export async function fetchUserById(userId){
    return mockUsers.find(u => u.id === userId);
}