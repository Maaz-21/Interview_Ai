// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArjKg0d_F54hC1tdm-VdfXqxDXnheAhPE",
  authDomain: "interview-a6df5.firebaseapp.com",
  projectId: "interview-a6df5",
  storageBucket: "interview-a6df5.firebasestorage.app",
  messagingSenderId: "860442867412",
  appId: "1:860442867412:web:1a448a8812829050296d41",
  measurementId: "G-X8SF03GSZC"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
