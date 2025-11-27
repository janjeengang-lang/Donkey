// ==== Firebase Configuration for Donkey ====

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCPHD2y24ICBtAqpRJOhR2QLvJFmQOyDek",
    authDomain: "john-the-ribber.firebaseapp.com",
    projectId: "john-the-ribber",
    storageBucket: "john-the-ribber.firebasestorage.app",
    messagingSenderId: "625781331894",
    appId: "1:625781331894:web:fc51a025e48075410f5317",
    measurementId: "G-H97EC3LRER"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

export { auth, app };