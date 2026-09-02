// Firebase is no longer part of the app — this lives in scripts/ so only the
// one-shot migration scripts can reach it. `firebase-admin` is a devDependency
// for the same reason: it must never end up in the Next.js bundle. Once the
// production cutover is verified, this file and the migrate* scripts can go.
import admin from "firebase-admin";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "{}"
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: "drawcells.appspot.com",
  });
}

export const adminApp = admin.app();
export const db = admin.database();
export const auth = admin.auth();
