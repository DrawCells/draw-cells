// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAr0dcOhdhNjwVe0_wyCQ4xNRDNbxKDV-E",
  authDomain: "drawcells.firebaseapp.com",
  databaseURL:
    "https://drawcells-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "drawcells",
  storageBucket: "drawcells.appspot.com",
  messagingSenderId: "1064736386948",
  appId: "1:1064736386948:web:6269ac0d0122a355a4b7d1",
  measurementId: "G-XKDGELLPXN",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();

export { auth, db, storage, googleProvider };
