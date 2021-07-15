import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';


const config = {
    apiKey: "AIzaSyBYsXwrbDpucuROiwK68IVqP6RGyH42tbY",
    authDomain: "tryenso.firebaseapp.com",
    projectId: "tryenso",
    storageBucket: "tryenso.appspot.com",
    messagingSenderId: "480566072887",
    appId: "1:480566072887:web:5860d7e36371deaa5651b2",
    measurementId: "G-VQYV5VYD4M"
  };

firebase.initializeApp(config);
export const auth = firebase.auth();
export const firestore = firebase.firestore();

export default firebase;
