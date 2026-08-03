import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDVkUAZrn1C9LC3VSnmZF_5mtzmsu7XjK8",
  authDomain: "chill-drink-290f2.firebaseapp.com",
  databaseURL: "https://chill-drink-290f2-default-rtdb.firebaseio.com",
  projectId: "chill-drink-290f2",
  storageBucket: "chill-drink-290f2.firebasestorage.app",
  messagingSenderId: "473627540050",
  appId: "1:473627540050:web:ec3e1f13992158987c7d8b",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
