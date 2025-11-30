// This file is deprecated. 
// Logic has been moved to backend/main.py to secure the API Key and centralize logic.
// The frontend now calls services/storageService.ts -> sendMessageToBackend()

export const sendMessageToGemini = async () => {
    throw new Error("Client-side Gemini calls are disabled. Please communicate via the Backend API.");
};
