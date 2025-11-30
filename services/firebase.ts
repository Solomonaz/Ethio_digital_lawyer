import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your web app's Firebase configuration
// Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyDFhK5YYfSQKckC1Xyq6rEPGwbo8f_zFAU",
  authDomain: "ethio-lex.firebaseapp.com",
  projectId: "ethio-lex",
  storageBucket: "ethio-lex.firebasestorage.app",
  messagingSenderId: "628985346870",
  appId: "1:628985346870:web:2cf5e80aab25aa16455197",
  measurementId: "G-N998S83XW7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Optional: Force account selection every time
googleProvider.setCustomParameters({
  prompt: 'select_account'
});