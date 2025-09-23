"use server";
import {db, auth} from "@/firebase/admin";
import {cookies} from "next/headers";

const ONE_WEEK = 60 * 60 * 24 * 7 * 1000; // 7 days in milliseconds

export async function signUp(params) {
  const { uid, name, email } = params;

  try {
    // check if user exists in db
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    // save user to db
    await db.collection("users").doc(uid).set({
      name,
      email,
      // profileURL,
      // resumeURL,
    });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params){
  const {email, idToken} = params;
  try{
    const userRecord =await auth.getUserByEmail(email);
    if(!userRecord){
      return {
        success: false,
        message: 'User not found. Please sign up.'
      }
    }
    await setSessionCookie(idToken);
    
  }catch(e){
    console.log(e);
    return {
      success: false,
      message: 'Failed to sign in. Please try again.'
    }
  }
}

export async function setSessionCookie(idToken){
  const cookieStore = await cookies();

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ONE_WEEK,
  })

  cookieStore.set('session', sessionCookie, 
                  {
                    maxAge: ONE_WEEK,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    path: '/',
                    sameSite: 'lax'
                  }
  );
}

export async function getCurrentUser(){
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if(!sessionCookie) return null;
  try{
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const userRecord = await db.collection('users').doc(decodedClaims.uid).get();
    if(!userRecord.exists) return null;
    return {id: userRecord.id, ...userRecord.data()};
  }catch(e){
    console.log(e);
    return null;
  }
}
export async function isAuthenticated(){
  const user = await getCurrentUser();
  return !!user;
}